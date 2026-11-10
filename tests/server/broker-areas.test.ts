import {test} from 'node:test';
import assert from 'node:assert/strict';
import {areaReadArguments,getAreaDb} from '../../src/modules/areas/db';
import {prepareAreaWrite,assertRecordArea} from '../../src/modules/areas/server';
import {conversionProspect,finishConversion,createDossierPolicy} from '../../src/modules/clientes/prospect-conversion';
import {policyInput} from '../../src/modules/clientes/dossier-policy';
import {businessLines} from '../../src/modules/areas/policy';
import type {Prisma} from '../../src/generated/prisma/client';
import {getDb} from '../../src/lib/db';
const actor={role:'ADMIN',email:'auto@example.invalid',productLines:['AUTO']};
const asDb=(value:unknown)=>value as Prisma.TransactionClient;
test('shared brokers receive prospect events for referrals without other private event streams',()=>{
 const shared={...actor,productLines:businessLines};
 const scope=(areaReadArguments('crmEvent',{},shared).where as {AND:unknown[]}).AND[1];
 assert.deepEqual(scope,{OR:[{actorEmail:actor.email},{auditOnly:false,module:{in:['prospectos','clientes','productos','aseguradoras']}}]});
 assert.deepEqual(areaReadArguments('crmEvent',{},actor).where,{AND:[{},{actorEmail:actor.email}]});
});
test('client nested operations, counts and unique lookups retain area filters',()=>{
 const args=areaReadArguments('client',{where:{id:'shared'},include:{policies:{include:{payments:true}},opportunities:true,_count:{select:{policies:true}}}},actor);
 const include=args.include as Record<string,Record<string,unknown>>;
 assert.deepEqual(include.policies.where,{AND:[{},{line:{in:['AUTO']}}]});
 assert.deepEqual((include.opportunities.where as {AND:unknown[]}).AND[1],{line:{in:['AUTO']}});
 const unique=areaReadArguments('policy',{where:{id:'secret'}},actor);
 assert.equal((unique.where as {id:string}).id,'secret');
 assert.deepEqual((unique.where as {AND:unknown[]}).AND[1],{line:{in:['AUTO']}});
 assert.deepEqual(areaReadArguments('clientNotice',{},actor).where,{AND:[{},{ownerEmail:actor.email}]});
 const clients=areaReadArguments('client',{where:{policies:{some:{status:'ACTIVE'}}}},actor);
 assert.deepEqual((clients.where as {policies:unknown}).policies,{some:{status:'ACTIVE',AND:[{status:'ACTIVE'},{line:{in:['AUTO']}}]}});
});
test('request db facade applies scope inside transactions and preserves promised reads',async()=>{
 const calls:unknown[]=[];
 const delegate={findMany:(args:unknown)=>{calls.push(args);return Promise.resolve([]);}};
 const base={policy:delegate,$transaction:async(fn:(tx:unknown)=>unknown)=>fn({policy:delegate})};
 const db=getAreaDb(actor,base as unknown as ReturnType<typeof getDb>);
 await db.$transaction(async tx=>{await tx.policy.findMany({where:{clientId:'shared'}});});
 assert.deepEqual(calls,[{where:{clientId:'shared',AND:[{clientId:'shared'},{line:{in:['AUTO']}}]}}]);
});
test('foreign operations and outside-area catalog writes are rejected before mutations',async()=>{
 await assert.rejects(()=>assertRecordArea(asDb({policy:{findFirst:async()=>null}}),'polizas','foreign',actor,true),{code:'RECORD_NOT_FOUND'});
 await assert.rejects(()=>prepareAreaWrite(asDb({}),'prospectos',{name:'Persona',line:'MEDICAL'},actor),{code:'AREA_FORBIDDEN'});
 await assert.rejects(()=>prepareAreaWrite(asDb({product:{findUnique:async()=>({line:'LIFE'})}}),'polizas',{productId:'life'},actor),{code:'AREA_FORBIDDEN'});
});
test('linked prospect uses authoritative contact and cannot change another dossier during conversion',async()=>{
 const db=asDb({accessGrant:{findUnique:async()=>({...actor,enabled:true})},client:{findFirst:async()=>({name:'Cliente real',email:null,phone:'12345678'})},prospect:{findFirst:async()=>({id:'p'}),findUnique:async()=>({id:'p',clientId:'existing',convertedClientId:null,archivedAt:null})}});
 const row=await prepareAreaWrite(db,'prospectos',{clientId:'existing',name:'Otro nombre',line:'AUTO'},actor);
 assert.equal(row.name,'Cliente real');assert.equal(row.phone,'12345678');
 await assert.rejects(()=>conversionProspect(db,'p',actor,'other-client'),{code:'PROSPECT_CLIENT_MISMATCH'});
 assert.equal((await conversionProspect(db,'p',actor,'existing'))?.clientId,'existing');
});
test('conversion uses atomic guard against concurrent duplicate conversions',async()=>{
 let completed=false;
 const db=asDb({prospect:{updateMany:async()=>{if(completed)return {count:0};completed=true;return {count:1};}}});
 await finishConversion(db,'p','existing');
 await assert.rejects(()=>finishConversion(db,'p','existing'),{code:'ALREADY_CONVERTED'});
});
test('policy conversion attaches to the existing dossier and rejects a different opportunity line',async()=>{
 const writes:Record<string,unknown>[]=[];
 const db=asDb({client:{findFirst:async()=>({id:'existing'})},accessGrant:{findUnique:async()=>({...actor,enabled:true})},policy:{create:async({data}:{data:Record<string,unknown>})=>{writes.push(data);return {id:'policy',number:'AUTO-1'};}}});
 const input=policyInput.parse({number:'AUTO-1',insurer:'Compañía',product:'Amplia',line:'AUTO',premium:1200,currency:'MXN',startDate:'2026-01-01',endDate:'2027-01-01',paymentFrequency:'ONCE',payments:[{amount:1200,dueDate:'2026-01-01'}]});
 await createDossierPolicy(db,'existing',input,actor,{line:'AUTO',ownerEmail:actor.email});
 assert.equal(writes.length,1);assert.equal(writes[0].clientId,'existing');assert.equal(writes[0].line,'AUTO');
 await assert.rejects(()=>createDossierPolicy(db,'existing',input,actor,{line:'MEDICAL',ownerEmail:actor.email}),{code:'PROSPECT_LINE_MISMATCH'});
 assert.equal(writes.length,1,'incompatible policy never reaches the write');
});
