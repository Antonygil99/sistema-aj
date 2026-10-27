import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { getDb } from '../src/lib/db';
import type { PrismaClient } from '../src/generated/prisma/client';
import { approveIntake, assertIntakeAccess, prepareIntakeDraft, publicIntake, revokeIntakeLink, rotateIntakeLink, staffIntake, submitIntake, unlockIntake } from '../src/modules/intake/server';
import { hashSecret } from '../src/modules/intake/tokens';
const db=getDb(),globalDb=globalThis as typeof globalThis & {ajDb?:PrismaClient};
const actor={id:'ROLLBACK-'+randomUUID(),name:'Validación de ficha',email:'fixture@example.test',role:'ADMIN' as const};
let verified=false;
try{
 await db.$transaction(async tx=>{
  globalDb.ajDb=new Proxy(tx,{get(target,key){if(key==='$transaction')return async(callback:(client:typeof tx)=>unknown)=>callback(tx);return Reflect.get(target,key);}}) as unknown as PrismaClient;
  const client=await tx.client.create({data:{name:'ROLLBACK-INTAKE-'+randomUUID(),email:'old@example.test'}});
  const link=await rotateIntakeLink(client.id,actor);
  await assert.rejects(assertIntakeAccess(client.id,{...actor,id:'other'}),{code:'FORBIDDEN'});
  await assert.rejects(assertIntakeAccess(client.id,{...actor,role:'USER'}),{code:'FORBIDDEN'});
  const stored=await tx.clientIntake.findUniqueOrThrow({where:{clientId:client.id}});
  assert.notEqual(stored.tokenHash,link.token);assert.notEqual(stored.pinHash,link.pin);
  const wrong=link.pin==='00000000'?'11111111':'00000000';
  for(let i=0;i<5;i++)await assert.rejects(unlockIntake(link.token,wrong),{code:'INTAKE_ACCESS_INVALID'});
  await assert.rejects(unlockIntake(link.token,link.pin),{code:'INTAKE_ACCESS_INVALID'});
  await tx.clientIntake.update({where:{id:stored.id},data:{lockedUntil:new Date(Date.now()-1000)}});
  const secret=await unlockIntake(link.token,link.pin);assert.deepEqual(await publicIntake(secret),{revision:0,answers:null,status:'DRAFT'});
  const answers={fullName:'Nombre sintético revisado',email:'new@example.test',privacyAccepted:true,informationConfirmed:true};
  await submitIntake(null,{expectedRevision:0,answers},null,secret);
  assert.equal((await tx.client.findUniqueOrThrow({where:{id:client.id}})).email,'old@example.test');
  await assert.rejects(publicIntake(secret),{code:'INTAKE_ACCESS_INVALID'});
  const review=await staffIntake(client.id,actor);assert.equal(review.intake?.status,'SUBMITTED');
  assert.ok(!JSON.stringify(review).includes(link.token));assert.ok(!JSON.stringify(review).includes(stored.tokenHash!));
  await assert.rejects(prepareIntakeDraft({cliente_id:client.id,expectedRevision:1,nombre:'Otro borrador'},actor),{code:'INTAKE_REVIEW_PENDING'});
  await approveIntake(client.id,{expectedRevision:1,expectedClientUpdatedAt:review.client.updatedAt.toISOString(),fields:['email'],reviewed:true},actor);
  const changed=await tx.client.findUniqueOrThrow({where:{id:client.id}});assert.equal(changed.email,'new@example.test');assert.equal(changed.name,client.name);
  await assert.rejects(approveIntake(client.id,{expectedRevision:1,expectedClientUpdatedAt:changed.updatedAt.toISOString(),fields:['name'],reviewed:true},actor),{code:'RECORD_CHANGED'});
  await prepareIntakeDraft({cliente_id:client.id,expectedRevision:1,nombre:'Propuesta de WhatsApp'},actor);
  const draft=await tx.clientIntake.findUniqueOrThrow({where:{id:stored.id}});assert.equal(draft.status,'DRAFT');assert.equal((draft.answers as {privacyAccepted:boolean}).privacyAccepted,false);
  await assert.rejects(submitIntake(client.id,{expectedRevision:1,answers},actor),{code:'RECORD_CHANGED'});
  const rotated=await rotateIntakeLink(client.id,actor);await assert.rejects(unlockIntake(link.token,link.pin),{code:'INTAKE_ACCESS_INVALID'});
  const second=await unlockIntake(rotated.token,rotated.pin);await revokeIntakeLink(client.id,actor);await assert.rejects(publicIntake(second),{code:'INTAKE_ACCESS_INVALID'});
  await tx.clientIntake.update({where:{id:stored.id},data:{tokenHash:hashSecret(rotated.token),pinHash:draft.pinHash,expiresAt:new Date(Date.now()-1000)}});
  await assert.rejects(unlockIntake(rotated.token,rotated.pin),{code:'INTAKE_ACCESS_INVALID'});
  assert.equal(await tx.clientIntakeRevision.count({where:{intakeId:stored.id}}),2);
  verified=true;throw new Error('ROLLBACK_INTAKE_VERIFIED');
 },{timeout:120000,maxWait:15000});
}catch(error){if(!(verified&&error instanceof Error&&error.message==='ROLLBACK_INTAKE_VERIFIED')){console.error('INTAKE_SMOKE_FAILED',error instanceof assert.AssertionError?error.message:(error as {code?:string}).code??'INTEGRATION_UNAVAILABLE');process.exitCode=1;}}
finally{globalDb.ajDb=db;await db.$disconnect();}
if(verified)console.log('INTAKE_VERIFIED: link hashing, lockout, owner scope, public submission, explicit review, selected master fields, agent draft, stale versions, rotation, expiry and revocation; fixtures rolled back; no messages sent.');
