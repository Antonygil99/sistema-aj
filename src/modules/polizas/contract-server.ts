import 'server-only';
import {createHash} from 'node:crypto';
import type {Prisma} from '@/generated/prisma/client';
import {ResourceError} from '../resources/rules';
import {policyDay,scheduleIssues} from './finance';

export async function lockPolicy(tx:Prisma.TransactionClient,id:string){
  await tx.$queryRaw`SELECT id FROM "Policy" WHERE id=${id} FOR UPDATE`;
}
export function scheduleVersion(rows:{id:string;updatedAt:Date}[]){
  return createHash('sha256').update(JSON.stringify(rows.map(r=>[r.id,r.updatedAt.toISOString()]).sort((a,b)=>a[0].localeCompare(b[0])))).digest('hex');
}
export async function activeFinancialPolicy(tx:Prisma.TransactionClient,id:string){
  const policy=await tx.policy.findUnique({where:{id},include:{client:{select:{archivedAt:true}}}});
  if(!policy||policy.archivedAt||policy.client.archivedAt||policy.status==='CANCELLED')throw new ResourceError('RECORD_NOT_FOUND',404);
  return policy;
}
export function validateContractSchedule(policy:{premium:unknown;currency:string;startDate:Date;endDate:Date;paymentFrequency?:string|null},rows:{amount:unknown;currency:string;dueDate:Date}[]){
  if(rows.some(row=>row.currency!==policy.currency))throw new ResourceError('FINANCE_CURRENCY_MISMATCH',422);
  const issue=scheduleIssues({premium:Number(policy.premium),startDate:policyDay(policy.startDate),endDate:policyDay(policy.endDate)},rows.map(row=>({amount:Number(row.amount),dueDate:policyDay(row.dueDate)})).sort((a,b)=>a.dueDate.localeCompare(b.dueDate)),policy.paymentFrequency??'MONTHLY');
  if(issue)throw new ResourceError('FINANCE_SCHEDULE_INVALID',422);
}
export async function validateReceiptUpdate(tx:Prisma.TransactionClient,id:string,data:Record<string,unknown>){
  const initial=await tx.payment.findUnique({where:{id}});
  if(!initial)throw new ResourceError('RECORD_NOT_FOUND',404);
  await lockPolicy(tx,initial.policyId);
  const receipt=await tx.payment.findUniqueOrThrow({where:{id}});
  const policy=await activeFinancialPolicy(tx,receipt.policyId);
  if(data.policyId!==receipt.policyId)throw new ResourceError('FINANCE_RECEIPT_POLICY_LOCKED',422);
  if(receipt.status==='PAID')throw new ResourceError('FINANCE_PAID_LOCKED',409);
  if(receipt.archivedAt)throw new ResourceError('RECORD_NOT_FOUND',404);
  if(data.status==='PAID')throw new ResourceError('FINANCE_USE_CONFIRMATION',422);
  const rows=await tx.payment.findMany({where:{policyId:receipt.policyId,archivedAt:null}});
  validateContractSchedule(policy,rows.map(row=>row.id===id?{amount:data.amount,currency:String(data.currency),dueDate:new Date(data.dueDate as Date)}:row));
}
export async function transferAutomaticFollowUps(tx:Prisma.TransactionClient,policyId:string,oldOwner:string|null,newOwner:string|null){
  if(oldOwner===newOwner)return;
  const procedures=await tx.insuranceProcedure.findMany({where:{policyId},select:{id:true}});
  const kinds=['SEGUIMIENTO_7','SEGUIMIENTO_30','SEGUIMIENTO_90','RENOVACION_'+policyId,...procedures.map(row=>'TRAMITE_'+row.id)];
  // Only generated, still-pending tasks follow their policy. Manual and completed work keeps its assignment.
  await tx.activity.updateMany({where:{policyId,archivedAt:null,status:'PENDING',kind:{in:kinds}},data:{ownerEmail:newOwner}});
}
export async function markScheduleForReview(tx:Prisma.TransactionClient,policyId:string){
  const policy=await tx.policy.findUnique({where:{id:policyId},select:{sourceData:true}});
  const source=policy?.sourceData&&typeof policy.sourceData==='object'&&!Array.isArray(policy.sourceData)?policy.sourceData as Prisma.InputJsonObject:{};
  await tx.policy.update({where:{id:policyId},data:{sourceData:{...source,paymentsNeedReview:true}}});
}
