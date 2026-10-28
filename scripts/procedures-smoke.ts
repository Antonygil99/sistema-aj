import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { getDb } from '../src/lib/db';
import type { PrismaClient } from '../src/generated/prisma/client';
import { startProcedure, procedureAccess, saveProcedureDraft, addProcedureAttachment, changeProcedureState, exportProcedure, scheduleProcedureFollowUp } from '../src/modules/procedures/server';
import { procedureData } from '../src/modules/procedures/schema';
const db=getDb(),globalDb=globalThis as typeof globalThis&{ajDb?:PrismaClient},actor={id:'ROLLBACK-'+randomUUID(),name:'Prueba de trámites',email:'procedure-fixture@example.test',role:'ADMIN' as const};
let verified=false;
// Warm the database connection before starting the bounded rollback transaction.
await db.$queryRaw`SELECT 1`;
try{await db.$transaction(async tx=>{
 globalDb.ajDb=new Proxy(tx,{get(target,key){if(key==='$transaction')return async(fn:(t:typeof tx)=>unknown)=>fn(tx);return Reflect.get(target,key);}}) as unknown as PrismaClient;
 const client=await tx.client.create({data:{name:'ROLLBACK-PROCEDURE-'+randomUUID()}}),other=await tx.client.create({data:{name:'ROLLBACK-OTHER-'+randomUUID()}});
 const product=await tx.product.create({data:{name:'ROLLBACK-GMM-'+randomUUID(),insurer:'METLIFE',line:'MEDICAL'}});
 const p=await tx.policy.create({data:{clientId:client.id,productId:product.id,number:randomUUID(),product:'GMM demo',insurer:'METLIFE',ownerEmail:actor.email,premium:100,currency:'MXN',startDate:new Date('2026-01-01'),endDate:new Date('2027-01-01')}});
 const request={policyId:p.id,change:'ADDRESS',requestKey:randomUUID()},row=await startProcedure(client.id,request,actor);assert.equal((await startProcedure(client.id,request,actor)).id,row.id);
 await assert.rejects(procedureAccess(row.id,{...actor,role:'USER'}),{code:'FORBIDDEN'});await assert.rejects(procedureAccess(row.id,{...actor,id:null}),{code:'FORBIDDEN'});await assert.rejects(procedureAccess(row.id,{...actor,id:'other',email:'other@example.test'}),{code:'RECORD_NOT_FOUND'});
 await assert.rejects(changeProcedureState(row.id,{expectedRevision:1,status:'REVIEWED',confirmed:true},actor),{code:'PROCEDURE_REVIEW_INCOMPLETE'});
 const data=procedureData.parse({change:'ADDRESS',givenNames:'Cliente',paternalSurname:'Sintético',taxId:'TEST900101AB1',phone:'+529991234567',place:'Mérida',date:'2026-10-27',requestedDate:'2026-11-01',street:'Calle de prueba',exterior:'1',colony:'Demo',postalCode:'97000',city:'Mérida',state:'Yucatán',contractorConfirmed:true,individualConfirmed:true,templateConfirmed:true});
 await saveProcedureDraft(row.id,{expectedRevision:1,data,followUpDate:'2026-10-29'},actor);assert.equal(await tx.activity.count({where:{kind:'TRAMITE_'+row.id}}),1);
 await assert.rejects(saveProcedureDraft(row.id,{expectedRevision:1,data},actor),{code:'RECORD_CHANGED'});
 await changeProcedureState(row.id,{expectedRevision:2,status:'REVIEWED',confirmed:true},actor);
 const storage=new Map<string,Uint8Array>();let puts=0;
 const fs={async put(key:string,b:Uint8Array){puts++;storage.set(key,b);},async remove(key:string){storage.delete(key);}};
 const exported=await exportProcedure(row.id,3,actor,fs);assert.equal((await exportProcedure(row.id,3,actor,fs)).id,exported.id);assert.equal(puts,1);
 assert.equal((await procedureAccess(row.id,actor)).status,'REVIEWED');
 await assert.rejects(changeProcedureState(row.id,{expectedRevision:3,status:'SUBMITTED',confirmed:true,reference:'DEMO',date:'2026-10-27'},actor),{code:'PROCEDURE_SUBMISSION_INCOMPLETE'});
 const bad=await tx.document.create({data:{name:'fixture',storageKey:randomUUID(),mimeType:'application/pdf',clientId:other.id}});
 await assert.rejects(addProcedureAttachment(row.id,{expectedRevision:3,kind:'IDENTITY',documentId:bad.id},actor),{code:'PROCEDURE_EVIDENCE_SCOPE'});
 let revision=3;for(const kind of ['IDENTITY','FORMAT5','ADDRESS_PROOF','SIGNED_REQUEST','ENDORSEMENT']){const doc=await tx.document.create({data:{name:'Fixture '+kind,storageKey:randomUUID(),mimeType:'application/pdf',clientId:client.id,policyId:p.id}});await addProcedureAttachment(row.id,{expectedRevision:revision,kind,documentId:doc.id},actor);revision++;}
 await scheduleProcedureFollowUp(row.id,revision,'2026-10-30',actor);revision++;assert.equal(await tx.activity.count({where:{kind:'TRAMITE_'+row.id}}),1);
 await changeProcedureState(row.id,{expectedRevision:revision,status:'SUBMITTED',confirmed:true,reference:'DEMO-FOLIO',date:'2026-10-27'},actor);revision++;
 await assert.rejects(saveProcedureDraft(row.id,{expectedRevision:revision,data},actor),{code:'PROCEDURE_STATE'});
 await changeProcedureState(row.id,{expectedRevision:revision,status:'COMPLETED',confirmed:true,date:'2026-11-01'},actor);
 assert.equal((await tx.activity.findFirstOrThrow({where:{kind:'TRAMITE_'+row.id}})).status,'DONE');
 const unchanged=await tx.policy.findUniqueOrThrow({where:{id:p.id}});assert.equal(unchanged.updatedAt.toISOString(),p.updatedAt.toISOString());assert.equal(String(unchanged.premium),'100');
 assert.equal(await tx.procedureRevision.count({where:{procedureId:row.id}}),revision+1);assert.equal(await tx.payment.count({where:{policyId:p.id}}),0);
 verified=true;throw new Error('ROLLBACK_PROCEDURES_VERIFIED');
},{timeout:90000,maxWait:30000});}catch(e){if(!verified||!(e instanceof Error)||e.message!=='ROLLBACK_PROCEDURES_VERIFIED')throw e;}finally{globalDb.ajDb=db;await db.$disconnect();}
console.log('PROCEDURES_DB_VERIFIED: scope, revisions, evidence, PDF idempotency, real stages, activity follow-up; rolled back, no messages and no policy/payment changes.');
