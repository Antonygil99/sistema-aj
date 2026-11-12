import 'server-only';
import {isAutoClaimStage} from '../siniestros/pipeline';
import {getDb} from '@/lib/db';
import {ResourceError} from '@/modules/resources/rules';
import {actorLines,canOperateLine,defaultLine,scopedWhere,unrestrictedAreas,type AreaActor} from './policy';
import type {Prisma} from '@/generated/prisma/client';
type Db=Prisma.TransactionClient;
const models:Record<string,string>={prospectos:'prospect',polizas:'policy',cotizaciones:'quote',pagos:'payment',renovaciones:'renewal',siniestros:'claim',actividades:'activity',productos:'product',documentos:'document',clientes:'client'};
type Lookup={findFirst(args:object):Promise<Record<string,unknown>|null>};
export async function assertRecordArea(db:Db,resource:string,id:string,actor?:AreaActor,write=false){
 const model=models[resource];if(!model)return;
 const row=await (db as unknown as Record<string,Lookup>)[model].findFirst({where:scopedWhere(resource,{id},actor)});
 if(!row)throw new ResourceError('RECORD_NOT_FOUND',404);
 if(write&&resource==='productos'&&!canOperateLine(actor,row.line))throw new ResourceError('AREA_FORBIDDEN',403);
 return row;
}
export function assertLine(actor:AreaActor|undefined,line:unknown){if(!canOperateLine(actor,line))throw new ResourceError('AREA_FORBIDDEN',403);}
// Normalizes a server-owned area before the final write; UI selection is never authority.
export async function prepareAreaWrite(db:Db,resource:string,input:Record<string,unknown>,actor?:AreaActor,previous?:Record<string,unknown>){
 const data={...input};
 if(resource==='siniestros'&&isAutoClaimStage(data.status??previous?.status)){
  const policy=await db.policy.findUnique({where:{id:String(data.policyId??previous?.policyId??'')},select:{line:true}});
  if(policy?.line!=='AUTO')throw new ResourceError('CLAIM_AUTO_STAGE_ONLY',422);
 }

 for(const [field,related] of [['policyId','polizas'],['prospectId','prospectos'],['claimId','siniestros']] as const){
  if(data[field])await assertRecordArea(db,related,String(data[field]),actor);
 }
 if(resource==='polizas'&&data.productId){const product=await db.product.findUnique({where:{id:String(data.productId)},select:{line:true,archivedAt:true}});if(!product||product.archivedAt)throw new ResourceError('POLICY_PRODUCT_UNAVAILABLE',422);data.line=previous?.productId===data.productId&&previous.line?previous.line:product.line;}
 if(resource==='cotizaciones'&&data.prospectId){const prospect=await db.prospect.findUnique({where:{id:String(data.prospectId)},select:{line:true}});if(prospect)data.line=prospect.line;}
 if(['prospectos','polizas','cotizaciones','productos'].includes(resource)){
  data.line=data.line??previous?.line??(resource==='productos'?'OTHER':defaultLine(actor));assertLine(actor,data.line);
  if(!data.ownerEmail&&['prospectos','polizas','productos'].includes(resource)&&actor?.email)data.ownerEmail=previous?.ownerEmail??actor.email;
  if(data.ownerEmail&&!unrestrictedAreas(actor)){const grant=await db.accessGrant.findUnique({where:{email:String(data.ownerEmail).toLowerCase()}});if(!grant||!grant.enabled||!['ADMIN','SUPERADMIN'].includes(grant.role)||!canOperateLine({role:grant.role,email:grant.email,productLines:grant.productLines},data.line))throw new ResourceError('AREA_OWNER_INVALID',422);}
 }
 if(resource==='prospectos'&&data.clientId){const client=await db.client.findFirst({where:{id:String(data.clientId),archivedAt:null},select:{id:true,name:true,email:true,phone:true}});if(!client)throw new ResourceError('RELATED_RECORD_NOT_FOUND',422);Object.assign(data,{name:client.name,email:client.email??undefined,phone:client.phone??undefined});}
 return data;
}
// Applies to specialized REST paths as well as generic CRUD. Domain services still
// validate scope at their final write; this also protects existing detail/download paths.
export async function authorizeAreaRequest(request:Request,actor:AreaActor){
 if(unrestrictedAreas(actor))return;
 const path=new URL(request.url).pathname.split('/').filter(Boolean);
 if(path[0]!=='api')return;
 const write=!['GET','HEAD','OPTIONS'].includes(request.method),db=getDb();
 let resource:string|undefined,id:string|undefined,previous:Record<string,unknown>|undefined;
 if(path[1]==='crm'){resource=path[2];id=path[3];}
 else {resource=({policies:'polizas',payments:'pagos',procedures:'procedimientos',products:'productos',documents:'documentos'} as Record<string,string>)[path[1]];id=path[2];}
 if(resource==='procedimientos'&&id){const p=await db.insuranceProcedure.findUnique({where:{id},select:{policyId:true}});if(!p)throw new ResourceError('RECORD_NOT_FOUND',404);await assertRecordArea(db,'polizas',p.policyId,actor);}
 else if(resource&&id&&models[resource])previous=await assertRecordArea(db,resource,id,actor,write);
 if(write&&request.headers.get('content-type')?.includes('application/json')){
  const body:unknown=await request.clone().json();
  if(body&&typeof body==='object'&&!Array.isArray(body)){
   const input=body as Record<string,unknown>;
   if(resource&&models[resource])await prepareAreaWrite(db,resource,input,actor,previous);
   else for(const [key,related] of [['policyId','polizas'],['prospectId','prospectos'],['claimId','siniestros']] as const)if(input[key])await assertRecordArea(db,related,String(input[key]),actor);
   if(input.policy&&typeof input.policy==='object')await prepareAreaWrite(db,'polizas',input.policy as Record<string,unknown>,actor);
  }
 }
}
export async function activeAreaActor(email:string){const grant=await getDb().accessGrant.findUnique({where:{email:email.toLowerCase()}});return grant?.enabled?{email:grant.email,role:grant.role,productLines:grant.productLines}:null;}
export {actorLines};
