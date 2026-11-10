import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {Prisma} from '../../src/generated/prisma/client';
import {validateContractSchedule,scheduleVersion,transferAutomaticFollowUps} from '../../src/modules/polizas/contract-server';
import {validateRenewalWrite} from '../../src/modules/renovaciones/contract-server';
import {proposeChange} from '../../src/modules/mcp/data';

test('cada calendario usa moneda, suma, fechas y pago único de su contrato',()=>{
 const policy={premium:'1200.00',currency:'MXN',startDate:new Date('2026-01-01'),endDate:new Date('2027-01-01'),paymentFrequency:'SEMIANNUAL'};
 const rows=[{amount:'600',currency:'MXN',dueDate:new Date('2026-01-01')},{amount:'600',currency:'MXN',dueDate:new Date('2026-07-01')}];
 assert.doesNotThrow(()=>validateContractSchedule(policy,rows));
 assert.throws(()=>validateContractSchedule(policy,[{...rows[0],currency:'USD'},rows[1]]),{code:'FINANCE_CURRENCY_MISMATCH'});
 for(const bad of [[{...rows[0],amount:'599.99'},rows[1]],[rows[0],{...rows[1],dueDate:new Date('2028-01-01')}],[rows[0],{...rows[1],dueDate:rows[0].dueDate}]])assert.throws(()=>validateContractSchedule(policy,bad),{code:'FINANCE_SCHEDULE_INVALID'});
 assert.throws(()=>validateContractSchedule({...policy,paymentFrequency:'ONCE'},rows),{code:'FINANCE_SCHEDULE_INVALID'});
 assert.throws(()=>validateContractSchedule(policy,[]),{code:'FINANCE_SCHEDULE_INVALID'});
});
test('la versión del calendario detecta cambios de recibos, altas, bajas y confirmaciones',()=>{
 const a={id:'a',updatedAt:new Date('2026-01-01')},b={id:'b',updatedAt:new Date('2026-01-01')};
 assert.equal(scheduleVersion([a,b]),scheduleVersion([b,a]));
 assert.notEqual(scheduleVersion([a,b]),scheduleVersion([a]));
 assert.notEqual(scheduleVersion([a,b]),scheduleVersion([a,{...b,updatedAt:new Date('2026-02-01')}]));
});
test('reasignación solo incluye seguimientos automáticos pendientes y no altera tareas manuales ni terminadas',async()=>{
 let captured:unknown;
 const tx={insuranceProcedure:{findMany:async()=>[{id:'procedure'}]},activity:{updateMany:async(args:unknown)=>{captured=args;}}} as unknown as Prisma.TransactionClient;
 await transferAutomaticFollowUps(tx,'policy','ale@example.invalid','joel@example.invalid');
 assert.deepEqual(captured,{where:{policyId:'policy',archivedAt:null,status:'PENDING',kind:{in:['SEGUIMIENTO_7','SEGUIMIENTO_30','SEGUIMIENTO_90','RENOVACION_policy','TRAMITE_procedure']}},data:{ownerEmail:'joel@example.invalid'}});
 captured=undefined;await transferAutomaticFollowUps(tx,'policy','same','same');assert.equal(captured,undefined);
});
test('un cambio de estado del listado no sustituye la nueva vigencia ni la preparación del desenlace',async()=>{
 let next=false,preparation:string|null=null;
 const tx={policy:{findUnique:async()=>({archivedAt:null,status:'ACTIVE',client:{archivedAt:null}}),findFirst:async()=>next?{id:'next'}:null},renewalPreparation:{findUnique:async()=>preparation?{status:preparation}:null}} as unknown as Prisma.TransactionClient;
 await validateRenewalWrite(tx,{policyId:'p',status:'PENDING'});
 for(const status of ['RENEWED','LOST'])await assert.rejects(validateRenewalWrite(tx,{policyId:'p',status}),{code:'FINANCE_USE_RENEWAL_FLOW'});
 await assert.rejects(validateRenewalWrite(tx,{policyId:'p',status:'RENEWED'},{policyId:'p',status:'CONTACTED'}),{code:'FINANCE_USE_RENEWAL_FLOW'});
 await validateRenewalWrite(tx,{policyId:'p',status:'RENEWED'},{policyId:'p',status:'RENEWED'});
 next=true;await assert.rejects(validateRenewalWrite(tx,{policyId:'p',status:'PENDING'}),{code:'FINANCE_USE_RENEWAL_FLOW'});
 next=false;preparation='NOT_RENEWED';await assert.rejects(validateRenewalWrite(tx,{policyId:'p',status:'CONTACTED'}),{code:'FINANCE_USE_RENEWAL_FLOW'});
});
test('MCP explica el flujo financiero antes de guardar una propuesta que no se podría aplicar',async()=>{
 const actor={id:'a',clientId:'app',role:'ADMIN' as const,name:'Fixture',email:'a@example.invalid',scopes:['crm:read','crm:write'],issuedAt:1};
 await assert.rejects(proposeChange(actor,{module:'pagos',operation:'create',data:{policyId:'p',amount:'10',currency:'MXN',dueDate:'2026-01-01T00:00:00Z',status:'PENDING'}}),{code:'FINANCE_USE_SCHEDULE'});
 await assert.rejects(proposeChange(actor,{module:'renovaciones',operation:'create',data:{policyId:'p',dueDate:'2026-01-01T00:00:00Z',status:'RENEWED'}}),{code:'FINANCE_USE_RENEWAL_FLOW'});
});
