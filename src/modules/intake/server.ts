import 'server-only';
import type { Actor } from '@/lib/api';
import { getDb } from '@/lib/db';
import { eventData } from '@/modules/events';
import { ResourceError } from '@/modules/resources/rules';
import { agentProfileSchema, approvalSchema, privacyVersion, submissionSchema } from './schema';
import { checkPin, hashPin, hashSecret, makePin, randomSecret } from './tokens';
import type { Prisma } from '@/generated/prisma/client';

export async function assertIntakeAccess(clientId:string,actor:Actor){
  if(!actor.id || !['ADMIN','SUPERADMIN'].includes(actor.role))throw new ResourceError('FORBIDDEN',403);
  const client=await getDb().client.findUnique({where:{id:clientId},include:{intake:{select:{createdById:true}},policies:{where:{archivedAt:null},select:{ownerEmail:true}}}});
  if(!client||client.archivedAt)throw new ResourceError('RECORD_NOT_FOUND',404);
  const owns=client.policies.some(p=>p.ownerEmail?.toLowerCase()===actor.email?.toLowerCase());
  const permitted=client.intake?(client.intake.createdById===actor.id||owns):(owns||!client.policies.some(p=>p.ownerEmail));
  if(actor.role!=='SUPERADMIN'&&!permitted)throw new ResourceError('FORBIDDEN',403);
  return client;
}
async function ensure(clientId:string,actor:Actor){
  await assertIntakeAccess(clientId,actor);
  const row=await getDb().clientIntake.upsert({where:{clientId},create:{clientId,createdById:actor.id!},update:{}});
  // A concurrent administrator may have become the creator while the upsert waited.
  await assertIntakeAccess(clientId,actor);
  return row;
}
export async function staffIntake(clientId:string,actor:Actor){
  const client=await assertIntakeAccess(clientId,actor), row=await getDb().clientIntake.findUnique({where:{clientId}});
  return {client:{name:client.name,email:client.email,phone:client.phone,taxId:client.taxId,updatedAt:client.updatedAt},
    intake:row?{status:row.status,revision:row.revision,answers:row.answers,approvedAnswers:row.approvedAnswers,approvedAt:row.approvedAt,expiresAt:row.expiresAt,linkActive:!!row.tokenHash&&!!row.expiresAt&&row.expiresAt>new Date()}:null};
}
export async function pendingIntakes(actor:Actor){
  if(!actor.id||!['ADMIN','SUPERADMIN'].includes(actor.role))return [];
  return getDb().clientIntake.findMany({where:{status:'SUBMITTED',client:{archivedAt:null},...(actor.role==='SUPERADMIN'?{}:{OR:[{createdById:actor.id},{client:{policies:{some:{archivedAt:null,ownerEmail:actor.email}}}}]})},select:{revision:true,client:{select:{id:true,name:true}}},orderBy:{updatedAt:'asc'},take:10});
}
export async function rotateIntakeLink(clientId:string,actor:Actor){
  const row=await ensure(clientId,actor), token=randomSecret(), pin=makePin(), tokenHash=hashSecret(token),expiresAt=new Date(Date.now()+7*86400000);
  await getDb().$transaction(async tx=>{
    await tx.clientIntake.update({where:{id:row.id},data:{tokenHash,pinHash:hashPin(pin,tokenHash),expiresAt,accessHash:null,accessExpiresAt:null,failedAttempts:0,lockedUntil:null}});
    await tx.crmEvent.create({data:eventData(actor,'updated','fichas',row.id,'Enlace de ficha renovado')});
  });
  return {token,pin,expiresAt};
}
export async function revokeIntakeLink(clientId:string,actor:Actor){
  await assertIntakeAccess(clientId,actor);
  await getDb().$transaction(async tx=>{
    await tx.clientIntake.updateMany({where:{clientId},data:{tokenHash:null,pinHash:null,expiresAt:null,accessHash:null,accessExpiresAt:null}});
    await tx.crmEvent.create({data:eventData(actor,'updated','fichas',clientId,'Enlace de ficha revocado')});
  });
}
const invalidLink = ()=>new ResourceError('INTAKE_ACCESS_INVALID',401);
// Token is transported in a URL fragment, never a path/query; verification is POST-only.
export async function unlockIntake(token:string,pin:string){
  if(!/^[A-Za-z0-9_-]{43}$/.test(token)||!/^\d{8}$/.test(pin))throw invalidLink();
  const db=getDb(), tokenHash=hashSecret(token), secret=randomSecret(), now=new Date();
  const result=await db.$transaction(async tx=>{
    const row=await tx.clientIntake.findUnique({where:{tokenHash},select:{id:true}});
    if(!row)return false;
    await tx.$queryRaw`SELECT id FROM "ClientIntake" WHERE id = ${row.id} FOR UPDATE`;
    const item=await tx.clientIntake.findUniqueOrThrow({where:{id:row.id},include:{client:{select:{archivedAt:true}}}});
    if(item.tokenHash!==tokenHash||!item.pinHash||!item.expiresAt||item.expiresAt<=now||item.client.archivedAt||(item.lockedUntil&&item.lockedUntil>now))return false;
    const attempts=item.lockedUntil&&item.lockedUntil<=now?0:item.failedAttempts;
    if(!checkPin(pin,tokenHash,item.pinHash)){
      await tx.clientIntake.update({where:{id:item.id},data:{failedAttempts:attempts+1,lockedUntil:attempts+1>=5?new Date(now.getTime()+15*60000):null}});return false;
    }
    await tx.clientIntake.update({where:{id:item.id},data:{failedAttempts:0,lockedUntil:null,accessHash:hashSecret(secret),accessExpiresAt:new Date(Math.min(now.getTime()+3600000,item.expiresAt.getTime()))}});return true;
  });
  if(!result)throw invalidLink();return secret;
}
export async function publicIntake(secret:string){
  if(!/^[A-Za-z0-9_-]{43}$/.test(secret))throw invalidLink();
  const row=await getDb().clientIntake.findUnique({where:{accessHash:hashSecret(secret)},include:{client:{select:{archivedAt:true}}}}),now=new Date();
  if(!row||!row.tokenHash||!row.accessExpiresAt||row.accessExpiresAt<=now||!row.expiresAt||row.expiresAt<=now||row.client.archivedAt)throw invalidLink();
  // Do not expose other CRM fields, policy numbers or the approved master profile publicly.
  return {revision:row.revision,answers:row.answers,status:row.status};
}
export async function submitIntake(clientId:string|null,input:unknown,actor:Actor|null,secret?:string){
  const data=submissionSchema.parse(input), db=getDb();
  const row=actor&&clientId?await ensure(clientId,actor):null;
  const accessHash=secret?hashSecret(secret):undefined;
  if(!row&&!accessHash)throw invalidLink();
  return db.$transaction(async tx=>{
    const found=row??await tx.clientIntake.findUnique({where:{accessHash}});
    if(!found)throw invalidLink();
    await tx.$queryRaw`SELECT id FROM "ClientIntake" WHERE id = ${found.id} FOR UPDATE`;
    const current=await tx.clientIntake.findUniqueOrThrow({where:{id:found.id},include:{client:{select:{archivedAt:true}}}}),now=new Date();
    if(current.client.archivedAt)throw invalidLink();
    if(!actor&&(!current.tokenHash||current.accessHash!==accessHash||!current.expiresAt||current.expiresAt<=now||!current.accessExpiresAt||current.accessExpiresAt<=now))throw invalidLink();
    if(current.revision!==data.expectedRevision)throw new ResourceError('RECORD_CHANGED',409);
    const revision=current.revision+1,answers=data.answers as Prisma.InputJsonObject;
    await tx.clientIntakeRevision.create({data:{intakeId:current.id,revision,answers,source:actor?'MANUAL':'EXTERNAL',actorId:actor?.id,privacyVersion}});
    await tx.clientIntake.update({where:{id:current.id},data:{revision,answers,status:'SUBMITTED',...(actor?{}:{accessHash:null,accessExpiresAt:null})}});
    const by=actor??{id:null,name:'Captura externa del cliente',email:null,role:'USER' as const};
    await tx.crmEvent.create({data:eventData(by,'updated','fichas',current.id,'Ficha recibida para revisión',{revision,source:actor?'MANUAL':'EXTERNAL'})});
    return {revision,status:'SUBMITTED'};
  });
}
export async function approveIntake(clientId:string,input:unknown,actor:Actor){
  await assertIntakeAccess(clientId,actor);const data=approvalSchema.parse(input),db=getDb();
  await db.$transaction(async tx=>{
    const row=await tx.clientIntake.findUnique({where:{clientId}});if(!row)throw new ResourceError('RECORD_NOT_FOUND',404);
    await tx.$queryRaw`SELECT id FROM "ClientIntake" WHERE id = ${row.id} FOR UPDATE`;
    const current=await tx.clientIntake.findUniqueOrThrow({where:{id:row.id}});
    if(current.status!=='SUBMITTED'||current.revision!==data.expectedRevision)throw new ResourceError('RECORD_CHANGED',409);
    const answers=submissionSchema.shape.answers.parse(current.answers),patch:{name?:string;email?:string;phone?:string;taxId?:string}={};
    if(data.fields.includes('name'))patch.name=answers.fullName;
    // Empty responses never erase an existing master field.
    for(const field of ['email','phone','taxId'] as const)if(data.fields.includes(field)&&answers[field])patch[field]=answers[field];
    if(Object.keys(patch).length){const updated=await tx.client.updateMany({where:{id:clientId,archivedAt:null,updatedAt:new Date(data.expectedClientUpdatedAt)},data:patch});if(!updated.count)throw new ResourceError('RECORD_CHANGED',409);}
    await tx.clientIntakeRevision.update({where:{intakeId_revision:{intakeId:row.id,revision:current.revision}},data:{reviewedAt:new Date(),reviewedById:actor.id}});
    await tx.clientIntake.update({where:{id:row.id},data:{status:'APPROVED',approvedAnswers:answers,approvedAt:new Date()}});
    await tx.crmEvent.create({data:eventData(actor,'updated','fichas',row.id,'Ficha revisada y aprobada',{revision:current.revision,masterFields:Object.keys(patch)})});
  });
}
// LLMs can propose basic contact drafts only; privacy/medical/banking contents never enter a tool result.
export async function intakeState(clientId:string,actor:Actor){
  await assertIntakeAccess(clientId,actor);
  const row=await getDb().clientIntake.findUnique({where:{clientId},select:{status:true,revision:true,approvedAt:true}});
  return {status:row?.status??'NOT_STARTED',revision:row?.revision??0,approved:!!row?.approvedAt,url:`/crm/clientes/${clientId}#ficha-cliente`};
}
export async function prepareIntakeDraft(input:unknown,actor:Actor){
  const data=agentProfileSchema.parse(input),row=await ensure(data.cliente_id,actor),db=getDb();
  await db.$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM "ClientIntake" WHERE id = ${row.id} FOR UPDATE`;
    const current=await tx.clientIntake.findUniqueOrThrow({where:{id:row.id}});
    if(current.revision!==data.expectedRevision)throw new ResourceError('RECORD_CHANGED',409);
    if(current.status==='SUBMITTED')throw new ResourceError('INTAKE_REVIEW_PENDING',409);
    const old=current.answers&&typeof current.answers==='object'&&!Array.isArray(current.answers)?current.answers as Prisma.InputJsonObject:{};
    const answers={...old,fullName:data.nombre,...(data.correo?{email:data.correo}:{}),...(data.telefono?{phone:data.telefono}:{}),privacyAccepted:false,informationConfirmed:false},revision=current.revision+1;
    await tx.clientIntakeRevision.create({data:{intakeId:row.id,revision,answers,source:'ASSISTANT',actorId:actor.id,privacyVersion:'not-obtained'}});
    await tx.clientIntake.update({where:{id:row.id},data:{answers,revision,status:'DRAFT'}});
    await tx.crmEvent.create({data:eventData(actor,'updated','fichas',row.id,'Borrador administrativo del asistente',{revision,source:'ASSISTANT'})});
  });
  return {url:`/crm/clientes/${data.cliente_id}#ficha-cliente`};
}
