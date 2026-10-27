import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { getDb } from '../src/lib/db';
import type { PrismaClient } from '../src/generated/prisma/client';
import { createPolicySchedule, confirmPayment, renewPolicy } from '../src/modules/polizas/finance-server';
import { makeSchedule } from '../src/modules/polizas/finance';
import { updateResource } from '../src/modules/resources/server';
const db=getDb(),globalDb=globalThis as typeof globalThis & {ajDb?:PrismaClient};
const actor={id:null,name:'Comprobación aislada',email:null,role:'ADMIN' as const};
let verified=false;
try{
 await db.$transaction(async tx=>{
  globalDb.ajDb=new Proxy(tx,{get(target,key){if(key==='$transaction')return async(callback:(client:typeof tx)=>unknown)=>callback(tx);return Reflect.get(target,key);}}) as unknown as PrismaClient;
  const client=await tx.client.create({data:{name:'ROLLBACK-FINANCE-'+randomUUID()}});
  const p=await tx.policy.create({data:{clientId:client.id,number:'ROLLBACK-'+randomUUID(),insurer:'Validación aislada',product:'Calendario de validación',premium:1200,currency:'MXN',startDate:new Date('2026-01-01'),endDate:new Date('2027-01-01')}});
  await createPolicySchedule(p.id,{expectedUpdatedAt:p.updatedAt.toISOString(),paymentFrequency:'MONTHLY',payments:makeSchedule(1200,12,'2026-01-31','MONTHLY'),reviewed:true},actor);
  const current=await tx.policy.findUniqueOrThrow({where:{id:p.id}}),payments=await tx.payment.findMany({where:{policyId:p.id},orderBy:{dueDate:'asc'}});
  assert.equal(payments.length,12);assert.ok(payments.every(r=>r.status==='PENDING'));
  await assert.rejects(createPolicySchedule(p.id,{expectedUpdatedAt:current.updatedAt.toISOString(),paymentFrequency:'ONCE',payments:[{amount:1200,dueDate:'2026-01-01'}],reviewed:true},actor),{code:'FINANCE_SCHEDULE_EXISTS'});
  const wrongClient=await tx.client.create({data:{name:'ROLLBACK-OTHER-'+randomUUID()}});
  const wrongDoc=await tx.document.create({data:{name:'fixture',clientId:wrongClient.id,storageKey:'rollback/'+randomUUID(),mimeType:'application/pdf'}});
  const doc=await tx.document.create({data:{name:'fixture evidence',clientId:client.id,storageKey:'rollback/'+randomUUID(),mimeType:'application/pdf'}});
  const input={expectedUpdatedAt:payments[0].updatedAt.toISOString(),paidAt:'2026-01-31',reference:'ROLLBACK-EVIDENCE',evidenceDocumentId:doc.id,reviewed:true};
  await assert.rejects(confirmPayment(payments[0].id,{...input,evidenceDocumentId:wrongDoc.id},actor),{code:'FINANCE_EVIDENCE_SCOPE'});
  await confirmPayment(payments[0].id,input,actor);
  await assert.rejects(confirmPayment(payments[0].id,input,actor),{code:'FINANCE_ALREADY_PAID'});
  const confirmed=await tx.payment.findUniqueOrThrow({where:{id:payments[0].id}});assert.equal(confirmed.evidenceDocumentId,doc.id);
  await assert.rejects(updateResource('pagos',confirmed.id,{expectedUpdatedAt:confirmed.updatedAt.toISOString(),policyId:p.id,amount:'100.00',currency:'MXN',dueDate:confirmed.dueDate.toISOString(),status:'PENDING'}),{code:'FINANCE_PAID_LOCKED'});
  const next=await renewPolicy(p.id,{expectedUpdatedAt:current.updatedAt.toISOString(),number:p.number,premium:1350,startDate:'2027-01-01',endDate:'2028-01-01',reviewed:true},actor);
  const old=await tx.policy.findUniqueOrThrow({where:{id:p.id}}),fresh=await tx.policy.findUniqueOrThrow({where:{id:next.id}});
  assert.equal(old.number,p.number);assert.equal(String(old.premium),'1200');assert.equal(old.startDate.toISOString(),p.startDate.toISOString());
  assert.equal(fresh.previousPolicyId,p.id);assert.equal(await tx.payment.count({where:{policyId:fresh.id}}),0);
  await assert.rejects(updateResource('polizas',old.id,{expectedUpdatedAt:old.updatedAt.toISOString(),number:old.number,clientId:client.id,insurer:old.insurer,product:old.product,premium:'9999.00',currency:'MXN',startDate:old.startDate.toISOString(),endDate:old.endDate.toISOString(),status:'ACTIVE'}),{code:'FINANCE_POLICY_HISTORY'});
  assert.equal(await tx.policy.count({where:{insurer:p.insurer,number:p.number}}),2);
  await assert.rejects(renewPolicy(p.id,{expectedUpdatedAt:current.updatedAt.toISOString(),number:p.number,premium:1350,startDate:'2027-01-01',endDate:'2028-01-01',reviewed:true},actor),{code:'FINANCE_RENEWAL_EXISTS'});
  verified=true;throw new Error('ROLLBACK_FINANCE_VERIFIED');
 },{timeout:120000,maxWait:15000});
}catch(error){if(!(verified&&error instanceof Error&&error.message==='ROLLBACK_FINANCE_VERIFIED')){console.error('FINANCE_SMOKE_FAILED',error instanceof assert.AssertionError?error.message:(error as {code?:string}).code??'INTEGRATION_UNAVAILABLE');process.exitCode=1;}}
finally{globalDb.ajDb=db;await db.$disconnect();}
if(verified)console.log('FINANCE_VERIFIED: calendars, evidence scope, payment confirmation, historical renewal with same real number and duplicate protection; all fixture rows rolled back; no email or WhatsApp sent.');
