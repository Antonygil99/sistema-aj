import 'dotenv/config';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '../src/generated/prisma/client';
import {migrationUrl} from './migration-url.mjs';
import {ownConversation,conversationScope} from '../src/modules/whatsapp/channels';
import {replyWhatsApp} from '../src/modules/whatsapp/send';
import {renewPolicy} from '../src/modules/polizas/finance-server';
import {renewalPreparation,saveRenewalPreparation} from '../src/modules/renovaciones/preparation-server';
import {getAuth} from '../src/lib/auth';
import {makeSignature} from 'better-auth/crypto';
import {GET as listConversations} from '../src/app/api/whatsapp/conversations/route';
import {GET as getConversation,PATCH as closeConversation} from '../src/app/api/whatsapp/conversations/[id]/route';
import {POST as replyRoute} from '../src/app/api/whatsapp/conversations/[id]/reply/route';
import {GET as channelSettings} from '../src/app/api/whatsapp/channels/route';
import {POST as saveResource} from '../src/app/api/resource-links/route';
import {GET as driveOverview,POST as driveConfigure,DELETE as driveDisconnect} from '../src/app/api/drive/route';
import {GET as driveCallback} from '../src/app/api/drive/connected/route';
import {GET as driveFiles} from '../src/app/api/drive/files/route';
import {PATCH as classifyDelivery} from '../src/app/api/documents/[id]/delivery/route';
import {deliverableWhere} from '../src/modules/documentos/delivery';
import {sendClientEmail} from '../src/modules/email/server';
import {publicResourceLinks} from '../src/modules/resource-links/server';
const db=new PrismaClient({adapter:new PrismaPg({connectionString:migrationUrl(process.env)!,connectionTimeoutMillis:15000})});
const state=globalThis as unknown as {ajDb:PrismaClient},oldDb=state.ajDb,oldFetch=globalThis.fetch;
const keys=['WHATSAPP_TOKEN_ALE','WHATSAPP_TOKEN_JOEL','WHATSAPP_API_VERSION'] as const,env=keys.map(k=>process.env[k]);
const rollback='ROLLBACK_BROKER_WORKFLOWS_VERIFIED',marker=randomUUID();let passed=false;
process.env.BETTER_AUTH_SECRET=randomUUID()+randomUUID();process.env.BETTER_AUTH_URL='https://example.invalid';
process.env.GOOGLE_CLIENT_ID='fixture-google';process.env.GOOGLE_CLIENT_SECRET='fixture-secret';process.env.AJ_SUPERADMIN_EMAIL='super-fixture@example.invalid';
try{await db.$transaction(async tx=>{
 // Fixture auth must never read/decrypt the production signing keyring with its temporary secret.
 const fixtureKeys=new Set<string>();
 const jwks={
   async findMany(args:Parameters<typeof tx.jwks.findMany>[0]={}){return tx.jwks.findMany({...args,where:{AND:[args?.where??{},{id:{in:[...fixtureKeys]}}]}});},
   async findFirst(args:Parameters<typeof tx.jwks.findFirst>[0]={}){return tx.jwks.findFirst({...args,where:{AND:[args?.where??{},{id:{in:[...fixtureKeys]}}]}});},
   async findUnique(args:Parameters<typeof tx.jwks.findUnique>[0]){return fixtureKeys.has(String(args.where.id))?tx.jwks.findUnique(args):null;},
   async create(args:Parameters<typeof tx.jwks.create>[0]){const row=await tx.jwks.create(args);fixtureKeys.add(row.id);return row;},
 };
 state.ajDb=new Proxy(tx,{get(target,key){if(key==='jwks')return jwks;if(key==='$transaction')return async(fn:(value:typeof tx)=>unknown)=>fn(tx);const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}}) as PrismaClient;
 const suffix=String(BigInt('0x'+marker.replaceAll('-','').slice(0,12))),aNumber='8'+suffix,jNumber='9'+suffix;
 // These are disposable actors, not real Ale or Joel accounts; no OAuth settings are changed.
 const a={id:'smoke-a-'+marker,name:'Broker fixture A',email:`a-${marker}@example.invalid`,role:'ADMIN' as const};
 const j={id:'smoke-j-'+marker,name:'Broker fixture B',email:`j-${marker}@example.invalid`,role:'ADMIN' as const};
 const sessionTokens=new Map<string,string>();
 for(const actor of [a,j]){
  await tx.authUser.create({data:{id:actor.id,name:actor.name,email:actor.email,emailVerified:true}});
  await tx.accessGrant.create({data:{email:actor.email,enabled:true,role:'ADMIN'}});
  const token=randomUUID();sessionTokens.set(actor.id,token);await tx.authSession.create({data:{id:randomUUID(),userId:actor.id,token,expiresAt:new Date(Date.now()+3600000)}});
 }
 const context=await getAuth()!.$context;
 async function request(actor:typeof a,path:string,init:RequestInit={}){const token=sessionTokens.get(actor.id)!;const cookie=context.authCookies.sessionToken.name+'='+encodeURIComponent(token+'.'+await makeSignature(token,process.env.BETTER_AUTH_SECRET!));return new Request('https://example.invalid'+path,{...init,headers:{cookie,origin:'https://example.invalid',...init.headers}});}
 await tx.whatsAppChannel.createMany({data:[{name:'Fixture A',ownerEmail:a.email,phoneNumberId:aNumber,credentialSlot:'FIXTURE_A_'+marker},{name:'Fixture B',ownerEmail:j.email,phoneNumberId:jNumber,credentialSlot:'FIXTURE_B_'+marker}]});
 const ca=await tx.whatsAppConversation.create({data:{phoneNumberId:aNumber,contactId:'529990000001',displayName:'Fixture',lastMessageAt:new Date(),lastInboundAt:new Date()}});
 const cj=await tx.whatsAppConversation.create({data:{phoneNumberId:jNumber,contactId:'529990000001',displayName:'Fixture',lastMessageAt:new Date(),lastInboundAt:new Date()}});
 assert.equal((await ownConversation(ca.id,a)).id,ca.id);
 await assert.rejects(ownConversation(cj.id,a),{code:'WA_NOT_FOUND'});
 await assert.rejects(ownConversation(ca.id,j),{code:'WA_NOT_FOUND'});
 assert.equal(await tx.whatsAppConversation.count({where:await conversationScope(a)}),1);
 assert.equal(await tx.whatsAppConversation.count({where:await conversationScope(j)}),1);
 assert.equal(await tx.whatsAppConversation.count({where:await conversationScope({...a,id:null,email:null})}),0);
 for(const actor of [a,j]){
  const listed=await listConversations(await request(actor,'/api/whatsapp/conversations?q=Fixture'));
  assert.equal(listed.status,200);const list=await listed.json();assert.equal(list.total,1);assert.equal(list.open,1);assert.equal(list.rows.length,1);
  assert.equal(list.rows[0].id,actor.id===a.id?ca.id:cj.id);
 }
 assert.equal((await channelSettings(await request(a,'/api/whatsapp/channels'))).status,403,'un broker no administra canales ajenos');
 const foreignContext={params:Promise.resolve({id:cj.id})};
 assert.equal((await getConversation(await request(a,'/api/whatsapp/conversations/'+cj.id),foreignContext)).status,404);
 assert.equal((await closeConversation(await request(a,'/api/whatsapp/conversations/'+cj.id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({closed:true})}),foreignContext)).status,404);
 assert.equal((await replyRoute(await request(a,'/api/whatsapp/conversations/'+cj.id+'/reply',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({body:'No enviar',requestId:randomUUID()})}),foreignContext)).status,404);
 assert.equal((await tx.whatsAppConversation.findUniqueOrThrow({where:{id:cj.id}})).closed,false);
 let externalCalls=0;globalThis.fetch=async()=>{externalCalls++;throw Error('NO_EXTERNAL_REQUESTS_ALLOWED');};
 await assert.rejects(replyWhatsApp(cj.id,'No enviar',randomUUID(),a),{code:'WA_NOT_FOUND'});
 assert.equal(externalCalls,0);
 // Number ownership can be disabled without deleting or projecting the historical conversation elsewhere.
 await tx.whatsAppChannel.updateMany({where:{ownerEmail:a.email},data:{enabled:false}});
 await assert.rejects(ownConversation(ca.id,a),{code:'WA_NOT_FOUND'});
 assert.equal(await tx.whatsAppConversation.count({where:{id:ca.id}}),1);
 const client=await tx.client.create({data:{name:'Workflow fixture '+marker}}),other=await tx.client.create({data:{name:'Other fixture '+marker}});
 const policy=await tx.policy.create({data:{number:'000-3403/'+marker,insurer:'Fixture',product:'Fixture',clientId:client.id,premium:'10000.00',currency:'MXN',startDate:new Date('2026-01-01'),endDate:new Date('2027-01-01')}});
 const old=await tx.document.create({data:{name:'Anterior fixture.pdf',mimeType:'application/pdf',storageKey:'fixture/'+marker+'/old.pdf',policyId:policy.id}});
 const next=await tx.document.create({data:{name:'Nueva fixture.pdf',mimeType:'application/pdf',storageKey:'fixture/'+marker+'/new.pdf',clientId:client.id}});
 const foreign=await tx.document.create({data:{name:'Ajeno fixture.pdf',mimeType:'application/pdf',storageKey:'fixture/'+marker+'/foreign.pdf',clientId:other.id}});
 const input={expectedUpdatedAt:null,expectedPolicyUpdatedAt:policy.updatedAt.toISOString(),status:'READY',number:'000-3403/NEXT-'+marker,premium:'12000.00',currency:'MXN',startDate:'2027-01-01',endDate:'2028-01-01',paymentNotes:'Revisar recibos emitidos',summary:'Propuesta de prueba',oldDocumentId:old.id,newDocumentId:next.id,channel:'',communicationNote:'',reviewed:true};
 await assert.rejects(saveRenewalPreparation(policy.id,{...input,newDocumentId:foreign.id},a),{code:'FINANCE_EVIDENCE_SCOPE'});
 const saved=await saveRenewalPreparation(policy.id,input,a);
 assert.equal(saved.comparison.percent,'20.00');assert.equal(saved.draft.status,'READY');
 await assert.rejects(saveRenewalPreparation(policy.id,input,a),{code:'RECORD_CHANGED'});
 const reread=await renewalPreparation(policy.id);assert.equal(reread.draft?.id,saved.draft.id);
 assert.equal(reread.policy.premium.toFixed(2),'10000.00');assert.equal(reread.policy.number,policy.number);
 assert.equal(await tx.payment.count({where:{policyId:policy.id}}),0,'preparar no crea recibos ni confirma cobros');
 let current=saved.draft;
 const advance=async(patch:Record<string,unknown>)=>{const old=current.data as Record<string,unknown>;const r=await saveRenewalPreparation(policy.id,{...old,...patch,expectedUpdatedAt:current.updatedAt.toISOString(),expectedPolicyUpdatedAt:policy.updatedAt.toISOString()},a);current=r.draft;};
 await assert.rejects(saveRenewalPreparation(policy.id,{...(current.data as object),premium:'13000.00',expectedUpdatedAt:current.updatedAt.toISOString(),expectedPolicyUpdatedAt:policy.updatedAt.toISOString()},a),{code:'RENEWAL_REVIEW_REQUIRED'});
 await advance({status:'COMMUNICATED',channel:'PHONE',communicationNote:'Fixture verified call',followUpDate:'2026-11-02'});
 await advance({status:'FOLLOW_UP',followUpDate:'2026-11-03'});
 assert.equal(await tx.activity.count({where:{kind:'RENOVACION_'+policy.id,archivedAt:null}}),1,'rescheduling reuses a single activity');
 assert.equal((await tx.activity.findFirstOrThrow({where:{kind:'RENOVACION_'+policy.id}})).dueDate?.toISOString().slice(0,10),'2026-11-03');
 await advance({status:'NOT_RENEWED',outcomeNote:'Fixture client declines'});
 assert.equal((await tx.activity.findFirstOrThrow({where:{kind:'RENOVACION_'+policy.id}})).status,'DONE');
 assert.equal((await tx.policy.findUniqueOrThrow({where:{id:policy.id}})).status,'ACTIVE','closing preparation does not cancel coverage');
 await advance({status:'PREPARING'});await advance({status:'READY'});
 const linked=await renewPolicy(policy.id,{expectedUpdatedAt:policy.updatedAt.toISOString(),number:'NEXT-'+marker,premium:12000,startDate:'2027-01-01',endDate:'2028-01-01',reviewed:true},a);
 assert.ok(linked.id);assert.equal((await tx.renewalPreparation.findUniqueOrThrow({where:{policyId:policy.id}})).status,'RENEWED');
 assert.equal((await tx.activity.findFirstOrThrow({where:{kind:'RENOVACION_'+policy.id}})).status,'DONE');
 assert.equal(await tx.payment.count({where:{policyId:linked.id}}),0,'new term does not fabricate receipts or mark payments');
 const resource={title:'Private fixture '+marker,description:'Internal fixture',category:'GUIDE',insurer:'Fixture',url:'https://example.invalid/internal',audience:'INTERNAL',active:true,publicReviewed:false};
 const internal=await saveResource(await request(a,'/api/resource-links',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(resource)}));assert.equal(internal.status,200);
 const publicInput={...resource,title:'Public fixture '+marker,url:'https://example.invalid/public',audience:'PUBLIC'};
 assert.equal((await saveResource(await request(a,'/api/resource-links',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(publicInput)}))).status,400,'no publicar sin revisión expresa');
 assert.equal((await saveResource(await request(a,'/api/resource-links',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...publicInput,publicReviewed:true})}))).status,200);
 const publicPage=JSON.stringify(await publicResourceLinks());assert.ok(publicPage.includes(publicInput.title));assert.equal(publicPage.includes(resource.title),false,'catálogo anónimo sin herramientas internas');
 // Classification and forced-send checks share actual SQL, with no call to storage or Resend.
 const classify=async(doc:typeof old,kind:string)=>classifyDelivery(await request(a,`/api/documents/${doc.id}/delivery`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedUpdatedAt:doc.updatedAt.toISOString(),deliveryKind:kind,reviewed:true})}),{params:Promise.resolve({id:doc.id})});
 assert.equal((await classify(next,'POLICY_COVER')).status,422,'a client-level file is not an approved policy document');
 assert.equal((await classify(old,'POLICY_COVER')).status,200);
 assert.equal((await classify(old,'INTERNAL')).status,409,'classification rejects a stale revision');
 assert.deepEqual((await tx.document.findMany({where:deliverableWhere(client.id),select:{id:true}})).map(d=>d.id),[old.id]);
 assert.equal(await tx.document.count({where:deliverableWhere(other.id)}),0);
 const body={requestId:randomUUID(),kind:'DOCUMENTOS' as const,clientId:client.id,to:['fixture@example.invalid'],subject:'Fixture',message:'Fixture',documentIds:[foreign.id]};
 await assert.rejects(sendClientEmail(a,body),{code:'EMAIL_IDENTITY_REQUIRED'});
 await tx.client.update({where:{id:client.id},data:{email:'fixture@example.invalid'}});
 await assert.rejects(sendClientEmail(a,{...body,deliveryConfirmation:{verified:true,reference:'Fixture call reference'}}),{code:'EMAIL_DOCUMENT_NOT_ALLOWED'});
 await assert.rejects(sendClientEmail({...a,id:null},body),{code:'FORBIDDEN'});
 const refreshed=await tx.document.findUniqueOrThrow({where:{id:old.id}});
 assert.equal((await classify(refreshed,'INTERNAL')).status,200);
 assert.equal(await tx.document.count({where:deliverableWhere(client.id)}),0,'revoking delivery removes the document from selectable attachments');
 const cfg=(folderId:string)=>({folderUrl:'https://drive.google.com/drive/folders/'+folderId});
 for(const [actor,root] of [[a,'fixture-root-a'],[j,'fixture-root-j']] as const){
  const r=await driveConfigure(await request(actor,'/api/drive',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(cfg(root))}));assert.equal(r.status,200);
  const overview=await driveOverview(await request(actor,'/api/drive'));const json=await overview.json();assert.equal(json.connected,false);assert.ok(json.folderUrl.endsWith(root));
 }
 assert.equal((await driveConfigure(await request(a,'/api/drive',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({folderUrl:'https://evil.invalid/folders/fake-root'})}))).status,422);
 await tx.driveConnection.update({where:{userId:j.id},data:{enabled:true}});
 const callback=await driveCallback(await request(a,'/api/drive/connected?attempt='+randomUUID()));assert.equal(callback.status,303);assert.ok(callback.headers.get('location')?.endsWith('result=reconnect'));
 assert.equal((await tx.driveConnection.findUniqueOrThrow({where:{userId:a.id}})).enabled,false,'callback cannot grant access without matching nonce and Google verification');
 assert.equal((await driveFiles(await request(a,'/api/drive/files'))).status,409,'no provider request before human authorization');
 assert.equal((await driveDisconnect(await request(a,'/api/drive',{method:'DELETE'}))).status,200);
 assert.equal((await tx.driveConnection.findUniqueOrThrow({where:{userId:j.id}})).enabled,true,'disconnect only affects the actor');
 passed=true;throw Error(rollback);
},{timeout:120000});}catch(e){if(!(e instanceof Error)||e.message!==rollback)throw e;}finally{state.ajDb=oldDb;globalThis.fetch=oldFetch;keys.forEach((k,i)=>{if(env[i]===undefined)delete process.env[k];else process.env[k]=env[i];});await db.$disconnect();}
assert.ok(passed);
console.log('BROKER_WORKFLOWS_VERIFIED: real SQL + signed human sessions, isolated HTTP lists/counts, foreign thread/reply/close denied, channel administration denied, disabled channels preserve history, renewal evidence/version/financial checks, explicit resource publication and public catalog excludes private links. All fixtures rolled back; no external messages.');
