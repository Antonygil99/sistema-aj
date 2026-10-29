import 'server-only';
import {getDb} from '@/lib/db';
import type {Actor} from '@/lib/api';
import {recordEvent} from '@/modules/events';
import {preparationSchema,premiumComparison} from './preparation';
import {ResourceError} from '@/modules/resources/rules';
export async function renewalPreparation(policyId:string){
  const db=getDb(),policy=await db.policy.findFirst({where:{id:policyId,archivedAt:null,client:{archivedAt:null}},select:{id:true,number:true,premium:true,currency:true,startDate:true,endDate:true,clientId:true,ownerEmail:true,updatedAt:true}});
  if(!policy)throw new ResourceError('RECORD_NOT_FOUND',404);
  const [draft,documents]=await Promise.all([db.renewalPreparation.findUnique({where:{policyId}}),db.document.findMany({where:{archivedAt:null,OR:[{policyId},{clientId:policy.clientId,policyId:null,claimId:null}]},select:{id:true,name:true},take:200,orderBy:{createdAt:'desc'}})]);
  return {policy,draft,documents};
}
export async function saveRenewalPreparation(policyId:string,input:unknown,actor:Actor){
  const d=preparationSchema.parse(input),db=getDb();
  if(!actor.id||actor.role==='USER')throw new ResourceError('FORBIDDEN',403);
  const result=await db.$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM "Policy" WHERE id=${policyId} FOR UPDATE`;
    const policy=await tx.policy.findFirst({where:{id:policyId,archivedAt:null,client:{archivedAt:null}}});
    if(!policy)throw new ResourceError('RECORD_NOT_FOUND',404);
    if(policy.updatedAt.toISOString()!==d.expectedPolicyUpdatedAt)throw new ResourceError('RECORD_CHANGED',409);
    if(d.startDate&&d.startDate<policy.endDate.toISOString().slice(0,10))throw new ResourceError('FINANCE_RENEWAL_DATES',422);
    const existing=await tx.renewalPreparation.findUnique({where:{policyId}});
    if((existing?.updatedAt.toISOString()??null)!==d.expectedUpdatedAt)throw new ResourceError('RECORD_CHANGED',409);
    for(const id of [d.oldDocumentId,d.newDocumentId].filter(Boolean)){
      const doc=await tx.document.findFirst({where:{id,archivedAt:null,OR:[{policyId},{clientId:policy.clientId,policyId:null,claimId:null}]}});
      if(!doc)throw new ResourceError('FINANCE_EVIDENCE_SCOPE',422);
    }
    if(d.status==='COMMUNICATED'&&existing?.status!=='READY'&&existing?.status!=='COMMUNICATED')throw new ResourceError('RENEWAL_NOT_READY',409);
    const {expectedUpdatedAt:_,expectedPolicyUpdatedAt:__,...data}=d;void _;void __;
    const values={data,status:d.status,updatedBy:actor.id!};
    const saved=existing?await tx.renewalPreparation.update({where:{policyId},data:values}):await tx.renewalPreparation.create({data:{...values,policyId}});
    return {draft:saved,comparison:premiumComparison(policy.premium.toFixed(2),d.premium,policy.currency,d.currency)};
  });
  await recordEvent(actor,'updated','renovaciones',policyId,'Preparación de renovación revisada');
  return result;
}
