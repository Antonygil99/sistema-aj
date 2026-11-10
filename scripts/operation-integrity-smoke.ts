import 'dotenv/config';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {PrismaClient,type Prisma} from '../src/generated/prisma/client';
import {PrismaPg} from '@prisma/adapter-pg';
import {migrationUrl} from './migration-url.mjs';
import {createResource,updateResource,archiveResource} from '../src/modules/resources/server';
import {confirmPayment,editPolicySchedule,policyFinance,renewPolicy} from '../src/modules/polizas/finance-server';
import {saveRenewalPreparation} from '../src/modules/renovaciones/preparation-server';
import {reviewQueue} from '../src/modules/revision/server';
const db=new PrismaClient({adapter:new PrismaPg({connectionString:migrationUrl(process.env)!,connectionTimeoutMillis:15000,query_timeout:30000,idleTimeoutMillis:1000})});
const globals=globalThis as typeof globalThis&{ajDb?:PrismaClient},previousDb=globals.ajDb;
const marker=randomUUID().replaceAll('-',''),rollback='ROLLBACK_OPERATION_VERIFIED';let verified=false;
const wrap=(tx:Prisma.TransactionClient)=>new Proxy(tx,{get(target,key){if(key==='$transaction')return async(fn:(tx:Prisma.TransactionClient)=>unknown)=>fn(tx);const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}}) as PrismaClient;
try{
 await db.$transaction(async tx=>{
  globals.ajDb=wrap(tx);
  const oldOwner=marker+'a@example.invalid',newOwner=marker+'b@example.invalid';
  await tx.accessGrant.createMany({data:[{email:oldOwner,enabled:true,role:'ADMIN'},{email:newOwner,enabled:true,role:'ADMIN'}]});
  const actor={id:marker,name:'Prueba reversible',email:oldOwner,role:'ADMIN' as const};
  const client=await tx.client.create({data:{name:'Fixture '+marker}});
  const policy=await tx.policy.create({data:{clientId:client.id,number:marker,insurer:'Fixture',product:'Prueba',premium:'1200',currency:'MXN',paymentFrequency:'SEMIANNUAL',ownerEmail:oldOwner,startDate:new Date('2026-01-01'),endDate:new Date('2027-01-01')}});
  const doc=await tx.document.create({data:{name:'Comprobante ficticio',storageKey:'fixture/'+marker,mimeType:'application/pdf',clientId:client.id}});
  const first=await tx.payment.create({data:{policyId:policy.id,amount:'600',currency:'MXN',dueDate:new Date('2026-01-01')}});
  const second=await tx.payment.create({data:{policyId:policy.id,amount:'600',currency:'MXN',dueDate:new Date('2026-07-01')}});
  await confirmPayment(first.id,{expectedUpdatedAt:first.updatedAt.toISOString(),paidAt:'2026-01-02',reference:'fixture-reference',evidenceDocumentId:doc.id,reviewed:true},actor);
  const paid=await tx.payment.findUniqueOrThrow({where:{id:first.id}});
  const receipt={policyId:policy.id,amount:'600',currency:'MXN',dueDate:'2026-08-01T00:00:00.000Z',status:'PENDING',expectedUpdatedAt:second.updatedAt.toISOString()};
  for(const patch of [{currency:'USD'},{amount:'500'},{dueDate:'2028-01-01T00:00:00.000Z'},{policyId:client.id}])await assert.rejects(updateResource('pagos',second.id,{...receipt,...patch}));
  await assert.rejects(createResource('pagos',{policyId:policy.id,amount:'600',currency:'MXN',dueDate:'2026-08-01T00:00:00.000Z',status:'PENDING'}),{code:'FINANCE_USE_SCHEDULE'});
  const before=await policyFinance(policy.id);
  const proposal={expectedUpdatedAt:before.policy.updatedAt.toISOString(),expectedScheduleVersion:before.scheduleVersion,paymentFrequency:'SEMIANNUAL',reviewed:true,payments:[{id:paid.id,amount:600,dueDate:'2026-01-01'},{amount:600,dueDate:'2026-11-01'}]};
  await assert.rejects(editPolicySchedule(policy.id,{...proposal,payments:[{amount:1200,dueDate:'2026-11-01'}]},actor),{code:'FINANCE_PAID_LOCKED'});
  await assert.rejects(editPolicySchedule(policy.id,{...proposal,payments:[{id:paid.id,amount:600,dueDate:'2026-01-01'},{id:paid.id,amount:600,dueDate:'2026-11-01'}]},actor),{code:'FINANCE_RECEIPT_SCOPE'});
  await editPolicySchedule(policy.id,proposal,actor);
  assert.ok((await tx.payment.findUniqueOrThrow({where:{id:second.id}})).archivedAt);
  const stillPaid=await tx.payment.findUniqueOrThrow({where:{id:paid.id}});
  assert.equal(stillPaid.reference,'fixture-reference');assert.equal(stillPaid.evidenceDocumentId,doc.id);assert.equal(stillPaid.updatedAt.getTime(),paid.updatedAt.getTime());
  await assert.rejects(editPolicySchedule(policy.id,proposal,actor),{code:'RECORD_CHANGED'});
  const tasks=await Promise.all([
    tx.activity.create({data:{title:'Generada',kind:'SEGUIMIENTO_7',policyId:policy.id,ownerEmail:oldOwner}}),
    tx.activity.create({data:{title:'Manual',policyId:policy.id,ownerEmail:oldOwner}}),
    tx.activity.create({data:{title:'Terminada',kind:'SEGUIMIENTO_30',policyId:policy.id,ownerEmail:oldOwner,status:'DONE'}}),
  ]);
  let current=await tx.policy.findUniqueOrThrow({where:{id:policy.id}});
  const body={number:marker,clientId:client.id,insurer:'Fixture',product:'Prueba',premium:'1200',currency:'MXN',paymentFrequency:'SEMIANNUAL',ownerEmail:newOwner,startDate:'2026-01-01T00:00:00.000Z',endDate:'2027-01-01T00:00:00.000Z',status:'ACTIVE',expectedUpdatedAt:current.updatedAt.toISOString()};
  await assert.rejects(updateResource('polizas',policy.id,{...body,premium:'1300'}),{code:'FINANCE_SCHEDULE_INVALID'});
  await assert.rejects(updateResource('polizas',policy.id,{...body,currency:'USD'}),{code:'FINANCE_CURRENCY_MISMATCH'});
  await updateResource('polizas',policy.id,body);
  assert.equal((await tx.activity.findUniqueOrThrow({where:{id:tasks[0].id}})).ownerEmail,newOwner);
  for(const task of tasks.slice(1))assert.equal((await tx.activity.findUniqueOrThrow({where:{id:task.id}})).ownerEmail,oldOwner);
  const full=await policyFinance(policy.id),pending=full.policy.payments.find(row=>row.status!=='PAID')!;
  await archiveResource('pagos',pending.id,true);
  assert.equal((await reviewQueue({kind:'schedule',q:marker})).rows.some(row=>row.id===policy.id),true);
  await archiveResource('pagos',pending.id,false);
  const renewed=await tx.renewal.create({data:{policyId:policy.id,dueDate:policy.endDate,status:'RENEWED'}});
  assert.equal((await reviewQueue({kind:'renewal',q:marker})).rows.some(row=>row.id===policy.id),true);
  await assert.rejects(createResource('renovaciones',{policyId:policy.id,dueDate:policy.endDate.toISOString(),status:'RENEWED'}),{code:'FINANCE_USE_RENEWAL_FLOW'});
  current=await tx.policy.findUniqueOrThrow({where:{id:policy.id}});
  const prep={expectedUpdatedAt:null,expectedPolicyUpdatedAt:current.updatedAt.toISOString(),status:'NOT_RENEWED',number:'',premium:'',currency:'MXN',startDate:'',endDate:'',paymentNotes:'',summary:'',oldDocumentId:'',newDocumentId:'',channel:'',communicationNote:'',reviewed:false,outcomeNote:'Decisión ficticia'};
  await saveRenewalPreparation(policy.id,prep,actor);
  assert.equal((await tx.renewal.findUniqueOrThrow({where:{id:renewed.id}})).status,'LOST');
  const draft=await tx.renewalPreparation.findUniqueOrThrow({where:{policyId:policy.id}});
  await saveRenewalPreparation(policy.id,{...prep,status:'PREPARING',expectedUpdatedAt:draft.updatedAt.toISOString()},actor);
  assert.equal((await tx.renewal.findUniqueOrThrow({where:{id:renewed.id}})).status,'PENDING');
  await renewPolicy(policy.id,{expectedUpdatedAt:current.updatedAt.toISOString(),number:marker+'-2',premium:1400,startDate:'2027-01-01',endDate:'2028-01-01',reviewed:true},actor);
  assert.equal((await tx.renewal.findUniqueOrThrow({where:{id:renewed.id}})).status,'RENEWED');
  assert.equal((await tx.renewalPreparation.findUniqueOrThrow({where:{policyId:policy.id}})).status,'RENEWED');
  assert.equal((await reviewQueue({kind:'renewal',q:marker})).rows.length,0);
  verified=true;throw Error(rollback);
 },{timeout:180000,maxWait:15000});
}catch(e){if(!(e instanceof Error&&e.message===rollback))throw e;}
finally{globals.ajDb=previousDb;await db.$disconnect();}
assert.ok(verified);console.log('OPERATION_VERIFIED: calendario atómico, confirmación con evidencia, pagos conservados, validaciones compartidas, archivo, reasignación selectiva, cola y cierre/reapertura/renovación coherentes. Todas las fixtures y eventos revertidos. Sin R2, correos, Google ni WhatsApp.');
