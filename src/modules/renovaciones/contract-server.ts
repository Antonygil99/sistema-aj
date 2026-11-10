import 'server-only';
import type {Prisma} from '@/generated/prisma/client';
import {ResourceError} from '../resources/rules';
import {activeFinancialPolicy} from '../polizas/contract-server';
export async function validateRenewalWrite(tx:Prisma.TransactionClient,data:Record<string,unknown>,existing?:{policyId:string;status:string}){
  if(existing&&existing.policyId!==data.policyId)throw new ResourceError('FINANCE_RENEWAL_POLICY_LOCKED',422);
  const closed=(status:unknown)=>status==='RENEWED'||status==='LOST';
  if((!existing&&closed(data.status))||(existing&&existing.status!==data.status&&(closed(existing.status)||closed(data.status))))throw new ResourceError('FINANCE_USE_RENEWAL_FLOW',422);
  await activeFinancialPolicy(tx,String(data.policyId));
  if(!closed(data.status)){
    const next=await tx.policy.findFirst({where:{previousPolicyId:String(data.policyId)},select:{id:true}});
    const prep=await tx.renewalPreparation.findUnique({where:{policyId:String(data.policyId)},select:{status:true}});
    if(next||prep?.status==='NOT_RENEWED'||prep?.status==='RENEWED')throw new ResourceError('FINANCE_USE_RENEWAL_FLOW',422);
  }
}
