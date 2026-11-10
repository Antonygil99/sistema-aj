import 'server-only';
import type {Prisma} from '@/generated/prisma/client';
import {ResourceError} from '@/modules/resources/rules';
import {assertRecordArea,assertLine,prepareAreaWrite} from '@/modules/areas/server';
import type {AreaActor} from '@/modules/areas/policy';
import {resolvePolicyCatalog} from '@/modules/polizas/catalog-server';
import type {z} from 'zod';
import type {policyInput} from './dossier-policy';
type Db=Prisma.TransactionClient;
export async function conversionProspect(db:Db,id:string|undefined,actor:AreaActor,clientId?:string){
 if(!id)return null;
 await assertRecordArea(db,'prospectos',id,actor,true);
 const prospect=await db.prospect.findUnique({where:{id}});
 if(!prospect||prospect.archivedAt)throw new ResourceError('RECORD_NOT_FOUND',404);
 if(prospect.convertedClientId)throw new ResourceError('ALREADY_CONVERTED',409);
 if(clientId&&prospect.clientId&&prospect.clientId!==clientId)throw new ResourceError('PROSPECT_CLIENT_MISMATCH',422);
 return prospect;
}
export async function finishConversion(db:Db,prospectId:string,clientId:string){
 const result=await db.prospect.updateMany({where:{id:prospectId,convertedClientId:null,archivedAt:null},data:{status:'CLIENTE',convertedClientId:clientId,clientId}});
 if(!result.count)throw new ResourceError('ALREADY_CONVERTED',409);
}
export async function createDossierPolicy(db:Db,clientId:string,input:z.infer<typeof policyInput>,actor:AreaActor,prospect?:{line:string;ownerEmail:string|null}|null){
 const client=await db.client.findFirst({where:{id:clientId,archivedAt:null},select:{id:true}});
 if(!client)throw new ResourceError('RECORD_NOT_FOUND',404);
 const {payments,...draft}=input;
 const normalized=await prepareAreaWrite(db,'polizas',{...draft,ownerEmail:draft.ownerEmail??prospect?.ownerEmail??actor.email,line:draft.line??prospect?.line},actor);
 const policy=await resolvePolicyCatalog(db,{...draft,...normalized},undefined,actor);
 assertLine(actor,policy.line);
 if(prospect&&policy.line!==prospect.line)throw new ResourceError('PROSPECT_LINE_MISMATCH',422);
 return db.policy.create({data:{...policy,clientId,startDate:new Date(policy.startDate),endDate:new Date(policy.endDate),payments:{create:payments.map(p=>({...p,currency:policy.currency,dueDate:new Date(p.dueDate)}))}},select:{id:true,number:true}});
}
