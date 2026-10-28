import 'server-only';
import { randomUUID } from 'node:crypto';
import { Prisma, type CrmImport } from '@/generated/prisma/client';
import { getDb } from '@/lib/db';
import type { Actor } from '@/lib/api';
import { eventData } from '@/modules/events';
import { contactRowSchema, ImportError, matchRows, normalizeContact, prepareImportSchema, reportCounts, csvCell, type Candidate, type MatchContact, type ImportTarget } from './rules';
export type ImportActor=Actor&{id:string;email:string};
type Db=Prisma.TransactionClient;
export function requireImportActor(actor:Actor):asserts actor is ImportActor{if(!actor.id||!actor.email||!['ADMIN','SUPERADMIN'].includes(actor.role))throw new ImportError('FORBIDDEN',403);}
async function batchAccess(batch:CrmImport|null,actor:ImportActor,db:Db,mcpClientId?:string){
  requireImportActor(actor);
  if(!batch||batch.userId!==actor.id||(mcpClientId&&batch.oauthClientId!==mcpClientId))throw new ImportError('IMPORT_NOT_FOUND',404);
  if(batch.oauthClientId&&batch.status==='READY'){const [consent,client]=await Promise.all([db.oauthConsent.findFirst({where:{userId:actor.id,clientId:batch.oauthClientId}}),db.oauthClient.findUnique({where:{clientId:batch.oauthClientId},select:{disabled:true}})]);if(!consent?.scopes.includes('crm:write')||!client||client.disabled)throw new ImportError('CONNECTION_REVOKED',403);}
  return batch;
}
async function existingContacts(db:Db):Promise<MatchContact[]>{
  const [clients,prospects]=await Promise.all([db.client.findMany({select:{id:true,name:true,email:true,phone:true,taxId:true,archivedAt:true},take:20001}),db.prospect.findMany({select:{id:true,name:true,email:true,phone:true,archivedAt:true},take:20001})]);
  if(clients.length>20000||prospects.length>20000)throw new ImportError('IMPORT_MATCH_LIMIT',413);
  return [...clients.map(r=>({...r,module:'clientes' as const})),...prospects.map(r=>({...r,module:'prospectos' as const}))];
}
async function preview(batch:CrmImport,db:Db){
  const stored=await db.crmImportRow.findMany({where:{batchId:batch.id},orderBy:{rowNumber:'asc'}});
  const candidates=stored.map(row=>({...row,data:row.data as unknown as Candidate['data']}));
  const rows=matchRows(candidates,await existingContacts(db));
  return {batch:{id:batch.id,target:batch.target as ImportTarget,sourceName:batch.sourceName,sourceKind:batch.sourceKind,status:batch.status==='READY'&&batch.expiresAt<new Date()?'EXPIRED':batch.status,countryCode:batch.countryCode,updatedAt:batch.updatedAt.toISOString(),expiresAt:batch.expiresAt.toISOString(),appliedAt:batch.appliedAt?.toISOString()??null},rows,counts:reportCounts(rows)};
}
export async function prepareBatch(actor:ImportActor,input:unknown,options:{oauthClientId?:string;sourceSha256?:string}={}){
  requireImportActor(actor);const data=prepareImportSchema.parse(input),db=getDb();
  if(await db.crmImport.count({where:{userId:actor.id,status:'READY',expiresAt:{gt:new Date()}}})>=10)throw new ImportError('IMPORT_PENDING_LIMIT',429);
  const batch=await db.crmImport.create({data:{userId:actor.id,oauthClientId:options.oauthClientId,target:data.target,sourceName:data.sourceName,sourceKind:data.sourceKind,sourceSha256:options.sourceSha256,countryCode:data.countryCode,expiresAt:new Date(Date.now()+86400000),rows:{create:data.rows.map((input,index)=>{const normalized=normalizeContact(input,data.target,data.countryCode);return {rowNumber:index+1,sourceRef:input.sourceRef,...normalized,data:normalized.data as Prisma.InputJsonObject};})}}});
  const view=await preview(batch,db);return {...view,reviewPath:`/importaciones/${batch.id}`};
}
export async function getBatch(actor:ImportActor,id:string,mcpClientId?:string){
  const db=getDb(),batch=await batchAccess(await db.crmImport.findUnique({where:{id}}),actor,db,mcpClientId);return preview(batch,db);
}
export async function editBatchRow(actor:ImportActor,id:string,input:{rowId:string;expectedUpdatedAt:string;data:unknown;allowNameMatch:boolean}){
  const normalizedInput=contactRowSchema.parse(input.data);
  return getDb().$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM "CrmImport" WHERE id=${id} FOR UPDATE`;
    const batch=await batchAccess(await tx.crmImport.findUnique({where:{id}}),actor,tx);
    if(batch.status!=='READY'||batch.expiresAt<new Date())throw new ImportError('IMPORT_EXPIRED',409);
    if(batch.updatedAt.toISOString()!==input.expectedUpdatedAt)throw new ImportError('RECORD_CHANGED',409);
    const normalized=normalizeContact(normalizedInput,batch.target as ImportTarget,batch.countryCode??undefined);
    const row=await tx.crmImportRow.updateMany({where:{id:input.rowId,batchId:id,status:'PENDING'},data:{...normalized,data:normalized.data as Prisma.InputJsonObject,allowNameMatch:input.allowNameMatch}});
    if(!row.count)throw new ImportError('IMPORT_ROW_NOT_FOUND',404);
    await tx.crmImport.update({where:{id},data:{updatedAt:new Date()}});
    return preview(await tx.crmImport.findUniqueOrThrow({where:{id}}),tx);
  },{maxWait:30000,timeout:30000});
}
export async function applyBatch(actor:ImportActor,id:string,input:{expectedUpdatedAt:string;selectedIds:string[];reviewed:boolean;cancel?:boolean}){
  requireImportActor(actor);const db=getDb();
  return db.$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM "CrmImport" WHERE id=${id} FOR UPDATE`;
    let batch=await batchAccess(await tx.crmImport.findUnique({where:{id}}),actor,tx);
    if(batch.status==='APPLIED')return preview(batch,tx);
    if(batch.status!=='READY'||batch.expiresAt<new Date())throw new ImportError('IMPORT_EXPIRED',409);
    if(batch.updatedAt.toISOString()!==input.expectedUpdatedAt)throw new ImportError('RECORD_CHANGED',409);
    if(input.cancel){batch=await tx.crmImport.update({where:{id},data:{status:'CANCELLED'}});return preview(batch,tx);}
    if(!input.reviewed||!input.selectedIds.length||input.selectedIds.length>500||new Set(input.selectedIds).size!==input.selectedIds.length)throw new ImportError('IMPORT_REVIEW_REQUIRED');
    // Serialize matching and inserts against both imports and ordinary contact changes. No partial commits.
    await tx.$executeRaw`LOCK TABLE "Client", "Prospect" IN SHARE ROW EXCLUSIVE MODE`;
    const view=await preview(batch,tx),selected=view.rows.filter(r=>input.selectedIds.includes(r.id));
    if(selected.length!==input.selectedIds.length||selected.some(r=>r.state!=='NEW'))throw new ImportError('IMPORT_MATCHES_CHANGED',409);
    const snapshots=JSON.stringify(view.rows.map(row=>({rowId:row.id,snapshot:{state:row.state,matches:row.matches}})));
    await tx.$executeRaw`UPDATE "CrmImportRow" r SET "reviewSnapshot"=m.snapshot FROM jsonb_to_recordset(${snapshots}::jsonb) AS m("rowId" text,snapshot jsonb) WHERE r.id=m."rowId" AND r."batchId"=${id}`;
    const created=selected.map(row=>({id:randomUUID(),row,data:row.data}));
    if(batch.target==='clientes'){
      await tx.client.createMany({data:created.map(({id,data})=>({id,name:data.name,email:data.email,phone:data.phone,taxId:data.taxId}))});
      await tx.documentFolder.createMany({data:created.flatMap(({id})=>['Identificación','Pólizas','Pagos','Siniestros'].map(name=>({id:randomUUID(),clientId:id,name})))});
    }else await tx.prospect.createMany({data:created.map(({id,data})=>({id,name:data.name,email:data.email,phone:data.phone,source:data.source||'Importación',ownerEmail:actor.email,status:'CURIOSO'}))});
    const mapping=JSON.stringify(created.map(({id,row})=>({rowId:row.id,resultId:id})));
    await tx.$executeRaw`UPDATE "CrmImportRow" r SET status='IMPORTED',"resultId"=m."resultId" FROM jsonb_to_recordset(${mapping}::jsonb) AS m("rowId" text,"resultId" text) WHERE r.id=m."rowId" AND r."batchId"=${id}`;
    await tx.crmImportRow.updateMany({where:{batchId:id,status:'PENDING'},data:{status:'SKIPPED'}});
    await tx.crmEvent.createMany({data:created.map(({id,row})=>eventData(actor,'created',batch.target,id,'Alta desde importación revisada',{importId:batch.id,sourceRow:row.rowNumber,channel:batch.oauthClientId?'MCP':'CRM'}))});
    await tx.crmEvent.create({data:eventData(actor,'created','importaciones',batch.id,'Importación revisada',{created:created.length,skipped:view.rows.length-created.length,target:batch.target})});
    batch=await tx.crmImport.update({where:{id},data:{status:'APPLIED',appliedAt:new Date()}});
    return preview(batch,tx);
  },{maxWait:30000,timeout:60000});
}
export async function importReport(actor:ImportActor,id:string){
  const view=await getBatch(actor,id),headers=['Fila','Referencia de origen','Estado','Nombre','Correo','Teléfono','RFC','ID creado','Pendientes','Coincidencias'];
  const csv='\uFEFF'+[headers,...view.rows.map(row=>[row.rowNumber,row.sourceRef,row.state,row.data.name,row.data.email,row.data.phone,row.data.taxId,row.resultId,[...row.issues,...row.warnings].join(' · '),row.matches.map(m=>m.module+': '+m.name).join(' · ')])].map(row=>row.map(csvCell).join(',')).join('\r\n');
  return csv;
}
export async function listBatches(actor:ImportActor){requireImportActor(actor);return getDb().crmImport.findMany({where:{userId:actor.id},select:{id:true,target:true,sourceName:true,sourceKind:true,status:true,createdAt:true,expiresAt:true,appliedAt:true},orderBy:{createdAt:'desc'},take:30});}
export type BatchView=Awaited<ReturnType<typeof getBatch>>;
