import 'server-only';
import { randomUUID } from 'node:crypto';
import { getDb } from '@/lib/db';
import type { Actor } from '@/lib/api';
import type { Prisma } from '@/generated/prisma/client';
import { getR2 } from '@/integrations/r2/server';
import { eventData } from '@/modules/events';
import { ResourceError } from '@/modules/resources/rules';
import { mexicoDay } from '@/modules/email/notices';
import { attachProcedure, createProcedure, procedureData, reviewIssues, saveProcedure, template, transitionProcedure, requiredAttachments } from './schema';
import { buildProcedurePdf, missingForExport, sha256 } from './pdf';

function fail(code:string,status=422):never{throw new ResourceError(code,status);}
function human(actor:Actor){if(!actor.id||!actor.email||!['ADMIN','SUPERADMIN'].includes(actor.role))fail('FORBIDDEN',403);}
const scope=(actor:Actor):Prisma.InsuranceProcedureWhereInput=>actor.role==='SUPERADMIN'?{}:{OR:[{createdById:actor.id!},{policy:{ownerEmail:{equals:actor.email!,mode:'insensitive'}}}]};
const active={client:{archivedAt:null},policy:{archivedAt:null}};
async function policyAccess(id:string,actor:Actor){
  human(actor);const p=await getDb().policy.findUnique({where:{id},include:{client:{include:{intake:true}},catalogProduct:true}});
  if(!p||p.archivedAt||p.client.archivedAt)fail('RECORD_NOT_FOUND',404);
  if(actor.role!=='SUPERADMIN'&&p.ownerEmail&&p.ownerEmail.toLowerCase()!==actor.email!.toLowerCase())fail('FORBIDDEN',403);
  return p;
}
export async function procedureAccess(id:string,actor:Actor){
  human(actor);const row=await getDb().insuranceProcedure.findFirst({where:{id,...active,...scope(actor)},include:{policy:{select:{id:true,number:true,insurer:true,product:true,startDate:true,endDate:true,updatedAt:true}},client:{select:{id:true,name:true}},attachments:{where:{active:true},include:{document:{select:{id:true,name:true,archivedAt:true}}}},exports:{select:{id:true,revision:true,createdAt:true}},revisions:{select:{revision:true,status:true,createdAt:true},orderBy:{revision:'desc'},take:30}}});
  if(!row)fail('RECORD_NOT_FOUND',404);return row;
}
const json=(value:unknown)=>JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
async function snapshot(tx:Prisma.TransactionClient,id:string,actor:Actor){
  const row=await tx.insuranceProcedure.findUniqueOrThrow({where:{id},include:{policy:{select:{ownerEmail:true}},attachments:{where:{active:true},select:{kind:true,documentId:true}}}});
  await tx.procedureRevision.create({data:{procedureId:id,revision:row.revision,status:row.status,actorId:actor.id!,snapshot:json({data:row.data,attachments:row.attachments,followUpDate:row.followUpDate,submissionReference:row.submissionReference,submittedAt:row.submittedAt,effectiveDate:row.effectiveDate})}});
  await tx.crmEvent.create({data:eventData(actor,'updated','tramites',id,'Seguimiento de trámite actualizado',{revision:row.revision,status:row.status})});
  const kind='TRAMITE_'+id,activity=await tx.activity.findFirst({where:{kind,clientId:row.clientId,archivedAt:null}});
  const closed=['COMPLETED','CANCELLED'].includes(row.status);
  if(activity)await tx.activity.update({where:{id:activity.id},data:{dueDate:row.followUpDate,status:closed||!row.followUpDate?'DONE':'PENDING'}});
  else if(row.followUpDate&&!closed)await tx.activity.create({data:{kind,title:'Seguimiento de trámite administrativo',clientId:row.clientId,policyId:row.policyId,ownerEmail:row.policy.ownerEmail??actor.email,dueDate:row.followUpDate}});
  return row;
}
async function locked(tx:Prisma.TransactionClient,id:string,expectedRevision:number,actor:Actor){
  await tx.$queryRaw`SELECT id FROM "InsuranceProcedure" WHERE id = ${id} FOR UPDATE`;
  const row=await tx.insuranceProcedure.findFirst({where:{id,...active,...scope(actor)},include:{attachments:{where:{active:true},include:{document:{select:{id:true,archivedAt:true}}}},policy:true}});
  if(!row)fail('RECORD_NOT_FOUND',404);if(row.revision!==expectedRevision)fail('RECORD_CHANGED',409);return row;
}
export async function clientProcedures(clientId:string,actor:Actor){
  human(actor);const db=getDb(),client=await db.client.findFirst({where:{id:clientId,archivedAt:null},select:{id:true,name:true,intake:{select:{approvedAnswers:true,approvedAt:true}}}});
  if(!client)fail('RECORD_NOT_FOUND',404);
  const policies=await db.policy.findMany({where:{clientId,archivedAt:null,...(actor.role==='SUPERADMIN'?{}:{OR:[{ownerEmail:null},{ownerEmail:{equals:actor.email!,mode:'insensitive'}}]})},select:{id:true,number:true,insurer:true,product:true,status:true,startDate:true,endDate:true,catalogProduct:{select:{line:true}}}});
  const rows=await db.insuranceProcedure.findMany({where:{clientId,...active,...scope(actor)},select:{id:true,revision:true,status:true,data:true,policy:{select:{number:true}},followUpDate:true,updatedAt:true},orderBy:{updatedAt:'desc'},take:50});
  // Scope approved administrative data to an actual responsible human, not merely a guessed client ID.
  if(actor.role!=='SUPERADMIN'&&!policies.length&&!rows.length)fail('FORBIDDEN',403);
  const documents=await db.document.findMany({where:{clientId,archivedAt:null,claimId:null,OR:[{policyId:null},{policyId:{in:policies.map(p=>p.id)}}]},select:{id:true,name:true,policyId:true},orderBy:{createdAt:'desc'},take:200});
  return {client:{id:client.id,name:client.name},approvedProfile:client.intake?.approvedAnswers??null,approvedAt:client.intake?.approvedAt??null,policies,rows,documents};
}
export async function procedureQueue(actor:Actor){human(actor);return getDb().insuranceProcedure.findMany({where:{...active,...scope(actor)},select:{id:true,revision:true,status:true,data:true,followUpDate:true,updatedAt:true,client:{select:{id:true,name:true}},policy:{select:{number:true}}},orderBy:[{followUpDate:'asc'},{updatedAt:'desc'}],take:100});}
export async function startProcedure(clientId:string,input:unknown,actor:Actor){
  const data=createProcedure.parse(input),p=await policyAccess(data.policyId,actor);
  if(p.clientId!==clientId)fail('PROCEDURE_SCOPE');
  if(!/^met\s*life$/i.test(p.insurer.trim())||p.catalogProduct?.line!=='MEDICAL'||p.status==='CANCELLED')fail('PROCEDURE_POLICY_UNSUPPORTED');
  const existing=await getDb().insuranceProcedure.findUnique({where:{requestKey:data.requestKey}});
  if(existing){await procedureAccess(existing.id,actor);if(existing.clientId!==clientId||existing.policyId!==data.policyId||procedureData.parse(existing.data).change!==data.change)fail('PROCEDURE_SCOPE');return {id:existing.id};}
  try{return await getDb().$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM "Policy" WHERE id = ${p.id} FOR UPDATE`;
    const current=await tx.policy.findUniqueOrThrow({where:{id:p.id}});
    if(current.updatedAt.getTime()!==p.updatedAt.getTime())fail('RECORD_CHANGED',409);
    const row=await tx.insuranceProcedure.create({data:{clientId,policyId:p.id,createdById:actor.id!,requestKey:data.requestKey,data:json(procedureData.parse({change:data.change})),sourceSnapshot:json({approvedProfile:p.client.intake?.approvedAnswers??null,approvedAt:p.client.intake?.approvedAt??null,policyNumber:p.number,policyUpdatedAt:p.updatedAt})}});
    await snapshot(tx,row.id,actor);return {id:row.id};
  });}catch(error){
    if((error as {code?:string}).code==='P2002'){
      const saved=await getDb().insuranceProcedure.findUnique({where:{requestKey:data.requestKey}});
      if(saved){await procedureAccess(saved.id,actor);if(saved.policyId!==p.id||saved.clientId!==clientId||procedureData.parse(saved.data).change!==data.change)fail('PROCEDURE_SCOPE');return {id:saved.id};}
    }
    throw error;
  }
}
export async function saveProcedureDraft(id:string,input:unknown,actor:Actor){
  human(actor);const data=saveProcedure.parse(input);
  if(data.data.date&&data.data.date>mexicoDay(new Date()))fail('PROCEDURE_FUTURE_DATE');
  return getDb().$transaction(async tx=>{
    const row=await locked(tx,id,data.expectedRevision,actor);if(row.status!=='DRAFT')fail('PROCEDURE_STATE',409);
    await tx.insuranceProcedure.update({where:{id},data:{data:json(data.data),revision:{increment:1},followUpDate:data.followUpDate?new Date(data.followUpDate):null}});
    await snapshot(tx,id,actor);return {saved:true};
  });
}
export async function addProcedureAttachment(id:string,input:unknown,actor:Actor){
  human(actor);const data=attachProcedure.parse(input);
  return getDb().$transaction(async tx=>{
    const row=await locked(tx,id,data.expectedRevision,actor);if(['COMPLETED','CANCELLED'].includes(row.status))fail('PROCEDURE_STATE',409);
    const doc=await tx.document.findUnique({where:{id:data.documentId}});
    if(!doc||doc.archivedAt||doc.clientId!==row.clientId||doc.claimId||(doc.policyId&&doc.policyId!==row.policyId))fail('PROCEDURE_EVIDENCE_SCOPE');
    await tx.procedureAttachment.updateMany({where:{procedureId:id,kind:data.kind},data:{active:false}});
    await tx.procedureAttachment.upsert({where:{procedureId_kind_documentId:{procedureId:id,kind:data.kind,documentId:doc.id}},create:{procedureId:id,kind:data.kind,documentId:doc.id},update:{active:true}});
    await tx.insuranceProcedure.update({where:{id},data:{revision:{increment:1}}});await snapshot(tx,id,actor);return {saved:true};
  });
}
export async function changeProcedureState(id:string,input:unknown,actor:Actor){
  human(actor);const data=transitionProcedure.parse(input),today=mexicoDay(new Date());
  return getDb().$transaction(async tx=>{
    const row=await locked(tx,id,data.expectedRevision,actor),d=procedureData.parse(row.data),kinds=row.attachments.filter(a=>!a.document.archivedAt).map(a=>a.kind);
    const allowed:Record<string,string[]>={DRAFT:['REVIEWED','CANCELLED'],REVIEWED:['DRAFT','AWAITING_SIGNATURE','SUBMITTED','CANCELLED'],AWAITING_SIGNATURE:['DRAFT','SUBMITTED','CANCELLED'],SUBMITTED:['COMPLETED','CANCELLED']};
    if(!allowed[row.status]?.includes(data.status))fail('PROCEDURE_STATE',409);
    if(data.status==='REVIEWED'&&reviewIssues(d).length)fail('PROCEDURE_REVIEW_INCOMPLETE');
    if(data.status==='SUBMITTED'){
      if([...requiredAttachments(d.change),'SIGNED_REQUEST'].some(kind=>!kinds.includes(kind))||!data.reference||!data.date||data.date>today)fail('PROCEDURE_SUBMISSION_INCOMPLETE');
    }
    if(data.status==='COMPLETED'&&(!kinds.includes('ENDORSEMENT')||!data.date))fail('PROCEDURE_ENDORSEMENT_REQUIRED');
    await tx.insuranceProcedure.update({where:{id},data:{status:data.status,revision:{increment:1},...(data.status==='SUBMITTED'?{submissionReference:data.reference,submittedAt:new Date(data.date)}:{}),...(data.status==='COMPLETED'?{effectiveDate:new Date(data.date)}:{})}});
    await snapshot(tx,id,actor);return {saved:true};
  });
}
export async function templateBytes(){
  const row=await getDb().insuranceTemplate.findUnique({where:{id:template.id}});
  if(!row||row.sha256!==template.hash||sha256(row.pdfBytes)!==template.hash)fail('PROCEDURE_TEMPLATE_CHANGED',409);return row.pdfBytes;
}
export async function scheduleProcedureFollowUp(id:string,expectedRevision:number,date:string,actor:Actor){
  human(actor);if(date&&!/^\d{4}-\d{2}-\d{2}$/.test(date))fail('INVALID_INPUT',400);
  return getDb().$transaction(async tx=>{const row=await locked(tx,id,expectedRevision,actor);if(['COMPLETED','CANCELLED'].includes(row.status))fail('PROCEDURE_STATE',409);await tx.insuranceProcedure.update({where:{id},data:{followUpDate:date?new Date(date):null,revision:{increment:1}}});await snapshot(tx,id,actor);return {saved:true};});
}
export async function exportProcedure(id:string,expectedRevision:number,actor:Actor,storage?:Pick<ReturnType<typeof getR2>,'put'|'remove'>){
  const row=await procedureAccess(id,actor);if(row.revision!==expectedRevision)fail('RECORD_CHANGED',409);
  if(!['REVIEWED','AWAITING_SIGNATURE'].includes(row.status))fail('PROCEDURE_STATE',409);
  const db=getDb(),existing=await db.procedureExport.findUnique({where:{procedureId_revision:{procedureId:id,revision:row.revision}}});if(existing)return {id:existing.id};
  const policySnapshot=row.sourceSnapshot as {policyNumber?:string;policyUpdatedAt?:string}|null;
  if(policySnapshot?.policyUpdatedAt!==row.policy.updatedAt.toISOString())fail('PROCEDURE_POLICY_CHANGED',409);
  const data=procedureData.parse(row.data),missing=missingForExport(data,row.attachments.filter(a=>!a.document.archivedAt).map(a=>a.kind));
  let bytes:Uint8Array;
  try{bytes=await buildProcedurePdf(await templateBytes(),{data,policyNumber:row.policy.number,revision:row.revision,missing});}catch(error){const code=error instanceof Error?error.message:'';if(/^PROCEDURE_/.test(code))fail(code);throw error;}
  const key=`procedures/${id}/exports/${row.revision}-${randomUUID()}.pdf`,r2=storage??getR2();await r2.put(key,bytes,'application/pdf');let keep=false;
  try{const result=await db.$transaction(async tx=>{
    const current=await locked(tx,id,row.revision,actor);if(!['REVIEWED','AWAITING_SIGNATURE'].includes(current.status))fail('PROCEDURE_STATE',409);
    if(current.policy.updatedAt.toISOString()!==policySnapshot?.policyUpdatedAt)fail('PROCEDURE_POLICY_CHANGED',409);
    const concurrent=await tx.procedureExport.findUnique({where:{procedureId_revision:{procedureId:id,revision:row.revision}}});
    if(concurrent)return {id:concurrent.id,keep:false};
    const result=await tx.procedureExport.create({data:{procedureId:id,revision:row.revision,storageKey:key,sha256:sha256(bytes),templateHash:template.hash}});
    await tx.crmEvent.create({data:eventData(actor,'updated','tramites',id,'Borrador PDF preparado',{revision:row.revision})});return {id:result.id,keep:true};
  });keep=result.keep;return {id:result.id};}finally{if(!keep)await r2.remove(key).catch(()=>{});}
}
export async function downloadProcedure(id:string,exportId:string,actor:Actor){await procedureAccess(id,actor);const row=await getDb().procedureExport.findFirst({where:{id:exportId,procedureId:id}});if(!row)fail('RECORD_NOT_FOUND',404);return getR2().downloadUrl(row.storageKey,`AJ-cambio-GMM-r${row.revision}-borrador.pdf`);}
