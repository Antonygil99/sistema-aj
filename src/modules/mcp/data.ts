import 'server-only';
import { z } from 'zod';
import { Prisma, type PrismaClient } from '@/generated/prisma/client';
import { getDb } from '@/lib/db';
import { schemas } from '@/modules/resources/rules';
import { createResource, updateResource, archiveResource, deleteResource } from '@/modules/resources/server';
import type { ResourceSlug } from '@/modules/resources/config';
import { folderInput, folderPatch } from '@/modules/documentos/folders';
import { documentFiles, type FileStorage } from '@/modules/documentos/file-operations';
import { attachmentSchema, validateFile, isManagedKey } from '@/modules/documentos/file-policy';
import { getR2 } from '@/integrations/r2/server';
import { eventData } from '@/modules/events';
import { revalidateActor, type McpActor } from './actor';
import { fields, models, project, safePatch, checkPermission, McpError, jsonData, type McpModule, type McpOperation } from './policy';
import { applyIntakeProposal, type IntakeShare } from './forms';
type Row = Record<string,unknown> & {id:string;updatedAt:Date};
type Delegate = {findUnique(args:object):Promise<Row|null>;findMany(args:object):Promise<Row[]>;count(args:object):Promise<number>;create(args:object):Promise<Row>;updateMany(args:object):Promise<{count:number}>;delete(args:object):Promise<Row>};
const delegate = (db:unknown,module:McpModule)=>(db as Record<string,Delegate>)[models[module][0].toLowerCase()+models[module].slice(1)];
const selectFor=(module:McpModule)=>Object.fromEntries(['id',...fields[module],'archivedAt','createdAt','updatedAt'].map(field=>[field,true]));
export const listInput=z.object({module:z.enum(Object.keys(models) as [McpModule,...McpModule[]]),query:z.string().trim().max(100).default(''),take:z.number().int().min(1).max(25).default(12),skip:z.number().int().min(0).max(10000).default(0),archived:z.boolean().default(false),clientId:z.string().min(1).max(100).optional()}).strict();
export async function listRecords(actor:McpActor,input:z.input<typeof listInput>) {
  const query=listInput.parse(input),resource=query.module;checkPermission(actor.role,actor.scopes,'read',resource);
  const names=['name','number','reference','title'].filter(field=>fields[resource].includes(field));
  const where={archivedAt:query.archived?{not:null}:null,...(query.query?{OR:names.map(field=>({[field]:{contains:query.query,mode:'insensitive'}}))}:{}),...(query.clientId?(fields[resource].includes('clientId')?{clientId:query.clientId}:{id:query.clientId}):{})};
  const db=delegate(getDb(),resource);
  const [rows,total]=await Promise.all([db.findMany({where,select:selectFor(resource),orderBy:[{updatedAt:'desc'},{id:'asc'}],skip:query.skip,take:query.take}),db.count({where})]);
  return {module:resource,rows:jsonData(rows),total,skip:query.skip,take:query.take};
}
export async function recordDetail(actor:McpActor,module:McpModule,id:string) {
  checkPermission(actor.role,actor.scopes,'read',module);
  const row=await delegate(getDb(),module).findUnique({where:{id},select:selectFor(module)});
  if(!row)throw new McpError('RECORD_NOT_FOUND',404);
  if(module!=='clientes')return {module,rows:[jsonData(row)],total:1};
  const db=getDb();
  const policies=await db.policy.findMany({where:{clientId:id,archivedAt:null},select:selectFor('polizas'),take:12,orderBy:{endDate:'asc'}});
  return {module,rows:[jsonData(row)],policies:jsonData(policies),total:1};
}
function fullInput(module:ResourceSlug,row:Row,patch:Record<string,unknown>):Record<string,unknown> {
  // Preserve fields absent from a partial agent edit, including fields the model must never read.
  const shape=(schemas[module] as z.ZodObject).shape;
  const existing=Object.fromEntries(Object.keys(shape).filter(key=>row[key]!==null&&row[key]!==undefined).map(key=>[key,jsonData(row[key])]));
  const merged={...existing,...patch};
  for(const key of Object.keys(merged))if(merged[key]===null)delete merged[key];
  return {...merged,expectedUpdatedAt:row.updatedAt.toISOString()};
}
function permittedOperation(module:McpModule,operation:McpOperation,data:Record<string,unknown>) {
  if(operation==='intake_link'||operation==='intake_draft')throw new McpError('USE_INTAKE_TOOL');
  if(operation==='upload'&&module!=='documentos')throw new McpError('INVALID_OPERATION');
  if(module==='documentos'&&operation==='create')throw new McpError('USE_UPLOAD_TOOL');
  if(module==='siniestros'&&operation==='create')throw new McpError('CLAIM_REQUIRES_PRIVATE_CRM_FORM');
  if(module==='documentos'&&operation==='update'&&Object.keys(data).some(k=>!['name','folderId'].includes(k)))throw new McpError('FILE_ASSOCIATION_LOCKED');
  if(module==='carpetas'&&operation==='update'&&Object.keys(data).some(k=>!['name','color'].includes(k)))throw new McpError('FOLDER_PARENT_LOCKED');
}
export async function proposeChange(actor:McpActor,input:{module:McpModule;operation:McpOperation;recordId?:string;expectedUpdatedAt?:string;data?:Record<string,unknown>},fileBytes?:Uint8Array) {
  checkPermission(actor.role,actor.scopes,input.operation,input.module);
  const data=safePatch(input.module,input.data??{});permittedOperation(input.module,input.operation,data);
  const db=getDb();
  if(await db.mcpChange.count({where:{userId:actor.id,status:'PENDING',expiresAt:{gt:new Date()}}})>=30)throw new McpError('TOO_MANY_PENDING_CHANGES',429);
  let version:Date|undefined;
  if(!['create','upload'].includes(input.operation)) {
    if(!input.recordId||!input.expectedUpdatedAt)throw new McpError('VERSION_REQUIRED');
    version=z.iso.datetime({offset:true}).transform(v=>new Date(v)).parse(input.expectedUpdatedAt);
    const row=await delegate(db,input.module).findUnique({where:{id:input.recordId}});
    if(!row)throw new McpError('RECORD_NOT_FOUND',404);
    if(row.updatedAt.getTime()!==version.getTime())throw new McpError('RECORD_CHANGED',409);
    if(input.operation==='update'&&!['documentos','carpetas'].includes(input.module)) {
      const merged=fullInput(input.module as ResourceSlug,row,data);delete merged.expectedUpdatedAt;
      if(input.module!=='prospectos'||merged.status!=='CLIENTE')schemas[input.module as ResourceSlug].parse(merged);
    }
  } else if(input.operation==='create') {
    (input.module==='carpetas'?folderInput:schemas[input.module as ResourceSlug]).parse(data);
  }
  if(input.operation==='upload') {
    attachmentSchema.parse(Object.fromEntries(Object.entries(data).filter(([k])=>['clientId','policyId','claimId'].includes(k))));
    if(fileBytes)validateFile(String(data.name),String(data.mimeType),fileBytes);
  }
  const change=await db.mcpChange.create({data:{userId:actor.id,clientId:actor.clientId,module:input.module,operation:input.operation,recordId:input.recordId,expectedUpdatedAt:version,data:jsonData(data),fileBytes:fileBytes?Buffer.from(fileBytes):undefined,expiresAt:new Date(Date.now()+15*60000)}});
  return {id:change.id,status:change.status,module:change.module,operation:change.operation,data,expiresAt:change.expiresAt.toISOString(),reviewPath:`/conexiones/revisar/${change.id}`};
}
export async function proposalForUser(id:string,userId:string) {
  const change=await getDb().mcpChange.findFirst({where:{id,userId},omit:{fileBytes:true}});
  if(!change)throw new McpError('PROPOSAL_NOT_FOUND',404);
  const row=change.recordId?await delegate(getDb(),change.module as McpModule).findUnique({where:{id:change.recordId},select:selectFor(change.module as McpModule)}):null;
  return {change:jsonData(change),before:row?jsonData(project(change.module as McpModule,row)):null};
}
// A transaction-scoped adapter reuses domain rules without opening nested independent transactions.
const transactionalDb=(tx:Prisma.TransactionClient)=>new Proxy(tx,{get(target,key){if(key==='$transaction')return async (fn:(client:Prisma.TransactionClient)=>unknown)=>fn(tx);const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}}) as PrismaClient;
export async function applyProposal(actor:McpActor,id:string,options:{cancel?:boolean;file?:{name:string;mimeType:string;body:Uint8Array};storage?:FileStorage}={}) {
  let uploadedKey:string|undefined,removeKey:string|undefined;
  let share:IntakeShare|undefined;
  const storage=()=>options.storage??getR2();
  try {
    const result=await getDb().$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM "McpChange" WHERE id=${id} FOR UPDATE`;
      const change=await tx.mcpChange.findFirst({where:{id,userId:actor.id,clientId:actor.clientId}});
      if(!change)throw new McpError('PROPOSAL_NOT_FOUND',404);
      if(change.status==='APPLIED')return {id:change.resultId,status:'APPLIED'};
      if(change.status!=='PENDING'||change.expiresAt.getTime()<Date.now())throw new McpError('PROPOSAL_EXPIRED',409);
      const resource=change.module as McpModule,operation=change.operation as McpOperation;
      checkPermission(actor.role,actor.scopes,operation,resource);
      if(options.cancel){await tx.mcpChange.update({where:{id},data:{status:'CANCELLED',fileBytes:null}});return {status:'CANCELLED'};}
      const db=transactionalDb(tx),data=change.data as Record<string,unknown>;
      let row:Row|null=null;
      if(change.recordId) {
        // Table identifier is from a closed server-owned map; record ID remains parameterized.
        await tx.$queryRaw(Prisma.sql`SELECT id FROM ${Prisma.raw('"'+models[resource]+'"')} WHERE id=${change.recordId} FOR UPDATE`);
        row=await delegate(db,resource).findUnique({where:{id:change.recordId}});
        if(!row||!change.expectedUpdatedAt||row.updatedAt.getTime()!==change.expectedUpdatedAt.getTime())throw new McpError('RECORD_CHANGED',409);
      }
      let result:Record<string,unknown>|null=null;
      if(operation==='intake_link'||operation==='intake_draft') {
        if(resource!=='clientes'||!change.recordId)throw new McpError('INVALID_OPERATION');
        const prepared=await applyIntakeProposal(actor,change.recordId,operation,data,db);share=prepared.share;result={id:prepared.id};
      } else if(operation==='upload') {
        const inputFile=options.file??(change.fileBytes?{name:String(data.name),mimeType:String(data.mimeType),body:change.fileBytes}:null);
        if(!inputFile)throw new McpError('FILE_REQUIRED');
        // The actor chooses the actual file on the trusted review page; metadata is validated again.
        const attachment=Object.fromEntries(Object.entries(data).filter(([k])=>['clientId','policyId','claimId'].includes(k)));
        const relatedClient=attachment.clientId?String(attachment.clientId):attachment.policyId?(await tx.policy.findUnique({where:{id:String(attachment.policyId)},select:{clientId:true}}))?.clientId:attachment.claimId?(await tx.claim.findUnique({where:{id:String(attachment.claimId)},select:{policy:{select:{clientId:true}}}}))?.policy.clientId:null;
        const folder=data.folderId?await tx.documentFolder.findUnique({where:{id:String(data.folderId)}}):null;
        if(data.folderId&&(!folder||folder.archivedAt||folder.clientId!==(relatedClient??null)))throw new McpError('FOLDER_SCOPE_MISMATCH',422);
        const files=documentFiles({
          async relatedExists(field,recordId){return Boolean(await delegate(tx,field==='clientId'?'clientes':field==='policyId'?'polizas':'siniestros').findUnique({where:{id:recordId},select:{id:true}}));},
          async create(values){const doc=await tx.document.create({data:{...values,folderId:folder?.id},select:{id:true,name:true,storageKey:true,mimeType:true}});uploadedKey=doc.storageKey;return doc;},
          async find(){return null;},
        },storage());
        result=await files.upload({...inputFile,attachment});
      } else if(['documentos','carpetas'].includes(resource)) {
        const d=delegate(db,resource);
        if(operation==='create') {
          const parsed=folderInput.parse(data);
          if(parsed.parentId){const parent=await tx.documentFolder.findUnique({where:{id:parsed.parentId}});if(!parent||parent.archivedAt||parent.clientId!==parsed.clientId)throw new McpError('FOLDER_SCOPE_MISMATCH',422);}
          result=await d.create({data:parsed});
        } else if(operation==='delete') {
          result=await d.delete({where:{id:change.recordId!}});
          if(resource==='documentos'&&isManagedKey(String(result.storageKey)))removeKey=String(result.storageKey);
        } else {
          let patch:Record<string,unknown>;
          if(operation==='archive'||operation==='restore')patch={archivedAt:operation==='archive'?new Date():null};
          else if(resource==='carpetas'){const parsed=folderPatch.parse({...data,expectedUpdatedAt:row!.updatedAt.toISOString()});patch=Object.fromEntries(Object.entries(parsed).filter(([key])=>key!=='expectedUpdatedAt'));}
          else {
            patch=z.object({name:z.string().trim().min(1).max(180).optional(),folderId:z.string().min(1).max(100).nullable().optional()}).strict().parse(data);
            if(patch.folderId){const folder=await tx.documentFolder.findUnique({where:{id:String(patch.folderId)}});const clientId=row!.clientId??(row!.policyId?(await tx.policy.findUnique({where:{id:String(row!.policyId)},select:{clientId:true}}))?.clientId:row!.claimId?(await tx.claim.findUnique({where:{id:String(row!.claimId)},select:{policy:{select:{clientId:true}}}}))?.policy.clientId:null);if(!folder||folder.archivedAt||folder.clientId!==clientId)throw new McpError('FOLDER_SCOPE_MISMATCH',422);}
          }
          await d.updateMany({where:{id:change.recordId!,updatedAt:change.expectedUpdatedAt!},data:patch});result=await d.findUnique({where:{id:change.recordId!}});
        }
      } else {
        const slug=resource as ResourceSlug;
        if(operation==='create')result=await createResource(slug,data,db);
        else if(operation==='update')result=await updateResource(slug,change.recordId!,fullInput(slug,row!,data),db);
        else if(operation==='archive'||operation==='restore')result=await archiveResource(slug,change.recordId!,operation==='archive',db);
        else if(operation==='delete') {
          if(slug==='productos'&&(await tx.product.findUnique({where:{id:change.recordId!},select:{imageKey:true}}))?.imageKey)throw new McpError('PRODUCT_IMAGE_DELETE_IN_CRM',409);
          result=await deleteResource(slug,change.recordId!,db);
        }
      }
      if(!result)throw new McpError('INVALID_OPERATION');
      const resultId=String(result.id),action={create:'created',update:'updated',archive:'archived',restore:'restored',delete:'deleted',upload:'uploaded',intake_link:'updated',intake_draft:'updated'}[operation] as Parameters<typeof eventData>[1];
      await tx.crmEvent.create({data:eventData(actor,action,operation.startsWith('intake_')?'fichas':resource,resultId,'Cambio revisado de conexión MCP',{proposalId:id,clientId:actor.clientId})});
      await tx.mcpChange.update({where:{id},data:{status:'APPLIED',resultId,fileBytes:null}});
      return {id:resultId,status:'APPLIED'};
    },{maxWait:30000,timeout:30000});
    if(removeKey)await storage().remove(removeKey).catch(()=>console.error('R2_ORPHAN_CLEANUP_REQUIRED'));
    return {...result,...share?{share}:{}};
  } catch(error){if(uploadedKey)await storage().remove(uploadedKey).catch(()=>console.error('R2_ORPHAN_CLEANUP_REQUIRED'));throw error;}
}
export async function liveProposalActor(userId:string,clientId:string,role:McpActor['role'],name:string,email:string) {
  const consent=await getDb().oauthConsent.findFirst({where:{userId,clientId}});
  if(!consent)throw new McpError('CONNECTION_REVOKED',401);
  const actor={id:userId,clientId,role,name,email,scopes:consent.scopes,issuedAt:Math.floor(Date.now()/1000)};
  return revalidateActor(actor);
}
