import 'server-only';
import {getDb} from '@/lib/db';
import type {Actor} from '@/lib/api';
import {eventData} from '@/modules/events';
import {preparationSchema,premiumComparison,canTransitionPreparation} from './preparation';
import {ResourceError} from '@/modules/resources/rules';
export async function renewalPreparation(policyId:string){
  const db=getDb(),policy=await db.policy.findFirst({where:{id:policyId,archivedAt:null,client:{archivedAt:null}},select:{id:true,number:true,premium:true,currency:true,startDate:true,endDate:true,clientId:true,ownerEmail:true,updatedAt:true}});
  if(!policy)throw new ResourceError('RECORD_NOT_FOUND',404);
  const [draft,documents,history]=await Promise.all([db.renewalPreparation.findUnique({where:{policyId}}),db.document.findMany({where:{archivedAt:null,OR:[{policyId},{clientId:policy.clientId,policyId:null,claimId:null}]},select:{id:true,name:true},take:200,orderBy:{createdAt:'desc'}}),db.crmEvent.findMany({where:{module:'renovaciones',recordId:policyId},select:{id:true,label:true,actorName:true,createdAt:true,details:true},take:30,orderBy:{createdAt:'desc'}})]);
  return {policy,draft,documents,history};
}
export async function saveRenewalPreparation(policyId:string,input:unknown,actor:Actor){
  const d=preparationSchema.parse(input),db=getDb();
  if(!actor.id||actor.role==='USER')throw new ResourceError('FORBIDDEN',403);
  const result=await db.$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM "Policy" WHERE id=${policyId} FOR UPDATE`;
    const policy=await tx.policy.findFirst({where:{id:policyId,archivedAt:null,client:{archivedAt:null}}});
    if(!policy)throw new ResourceError('RECORD_NOT_FOUND',404);
    if(await tx.policy.findFirst({where:{previousPolicyId:policyId},select:{id:true}}))throw new ResourceError('FINANCE_RENEWAL_EXISTS',409);
    if(policy.updatedAt.toISOString()!==d.expectedPolicyUpdatedAt)throw new ResourceError('RECORD_CHANGED',409);
    if(d.startDate&&d.startDate<policy.endDate.toISOString().slice(0,10))throw new ResourceError('FINANCE_RENEWAL_DATES',422);
    const existing=await tx.renewalPreparation.findUnique({where:{policyId}});
    if((existing?.updatedAt.toISOString()??null)!==d.expectedUpdatedAt)throw new ResourceError('RECORD_CHANGED',409);
    for(const id of [d.oldDocumentId,d.newDocumentId].filter(Boolean)){
      const doc=await tx.document.findFirst({where:{id,archivedAt:null,OR:[{policyId},{clientId:policy.clientId,policyId:null,claimId:null}]}});
      if(!doc)throw new ResourceError('FINANCE_EVIDENCE_SCOPE',422);
    }
    if(!canTransitionPreparation(existing?.status??'PREPARING',d.status))throw new ResourceError('RENEWAL_STAGE_INVALID',409);
    if(existing&&['READY','COMMUNICATED','FOLLOW_UP'].includes(existing.status)&&d.status!=='PREPARING'&&['number','premium','currency','startDate','endDate','oldDocumentId','newDocumentId','deductible','coinsurance','insuredAmount','coverageChanges','paymentNotes','summary'].some(key=>{const old=existing.data as Record<string,unknown>;return (old[key]??'')!==(d as Record<string,unknown>)[key];}))throw new ResourceError('RENEWAL_REVIEW_REQUIRED',409);
    const {expectedUpdatedAt:_,expectedPolicyUpdatedAt:__,...data}=d;void _;void __;
    const values={data,status:d.status,updatedBy:actor.id!};
    const saved=existing?await tx.renewalPreparation.update({where:{policyId},data:values}):await tx.renewalPreparation.create({data:{...values,policyId}});
    const kind='RENOVACION_'+policyId,activity=await tx.activity.findFirst({where:{policyId,kind,archivedAt:null}});
    const closed=d.status==='NOT_RENEWED';
    const task={title:'Seguimiento de renovación · '+policy.number,dueDate:d.followUpDate?new Date(d.followUpDate):null,status:closed||!d.followUpDate?'DONE' as const:'PENDING' as const,ownerEmail:policy.ownerEmail??actor.email};
    if(activity)await tx.activity.update({where:{id:activity.id},data:task});
    else if(d.followUpDate&&!closed)await tx.activity.create({data:{...task,kind,policyId,clientId:policy.clientId}});
    await tx.crmEvent.create({data:eventData(actor,'updated','renovaciones',policyId,'Preparación de renovación actualizada',{from:existing?.status??'PREPARING',to:d.status,followUpDate:d.followUpDate})});
    return {draft:saved,comparison:premiumComparison(policy.premium.toFixed(2),d.premium,policy.currency,d.currency)};
  });
  return result;
}
