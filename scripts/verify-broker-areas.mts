import 'dotenv/config';
import assert from 'node:assert/strict';
import {getDb} from '../src/lib/db';
import {getAreaDb} from '../src/modules/areas/db';
import {listResource} from '../src/modules/resources/server';
import {assertRecordArea,prepareAreaWrite} from '../src/modules/areas/server';
import {businessLines,defaultLine} from '../src/modules/areas/policy';
import {ownChannels} from '../src/modules/whatsapp/channels';
if(!process.argv[2]||!process.argv[3])throw Error('Use los correos de Autos y Salud/Vida como argumentos, en ese orden. Esta verificación solo consulta datos.');
const raw=getDb();
try{
 const output=[];
 for(const email of [process.argv[2],process.argv[3]]){
  const grant=await raw.accessGrant.findUniqueOrThrow({where:{email}});
  const areas=grant.productLines;
  assert.ok(areas.length>0&&areas.every(line=>businessLines.includes(line)));assert.equal(grant.enabled,true);assert.equal(grant.role,'ADMIN');
  const actor={role:grant.role,email:grant.email,productLines:grant.productLines},db=getAreaDb(actor);
  const [policies,prospects,contacts,products,sharedClient]=await Promise.all([
   db.policy.findMany({select:{id:true,line:true},where:{archivedAt:null}}),
   db.prospect.findMany({select:{id:true,line:true},where:{archivedAt:null}}),
   db.client.count(),db.product.count(),
   db.client.findFirst({include:{policies:{select:{id:true,line:true,payments:{select:{id:true}}}},convertedFrom:{select:{id:true,line:true}},opportunities:{select:{id:true,line:true}},_count:{select:{policies:true,referrals:true}}}}),
  ]);
  assert.ok(policies.every(p=>areas.includes(p.line as never)));assert.ok(prospects.every(p=>areas.includes(p.line as never)));
  assert.ok(sharedClient?.policies.every(p=>areas.includes(p.line as never)));
  const foreign=await raw.policy.findFirst({where:{OR:[{line:{notIn:[...areas]}},{line:null}]},select:{id:true}});
  if(foreign){assert.equal(await db.policy.findUnique({where:{id:foreign.id}}),null);await assert.rejects(()=>assertRecordArea(raw,'polizas',foreign.id,actor,true),{code:'RECORD_NOT_FOUND'});}
  for(const resource of ['prospectos','polizas','pagos','cotizaciones','clientes','productos'] as const)await listResource(resource,{take:2},actor);
  await db.$transaction(async tx=>{await tx.policy.count();await tx.client.count({where:{policies:{some:{status:'ACTIVE'}}}});});
  const user=await raw.authUser.findUnique({where:{email},select:{id:true}});
  const channels=await ownChannels({...actor,id:user?.id??null,name:'Verificación'});
  assert.ok(channels.every(channel=>channel.ownerEmail===email));
  let referralValidated=false;
  if(areas.length===businessLines.length&&sharedClient){
   const recipient=process.argv[2]===email?process.argv[3]:process.argv[2],line=process.argv[2]===email?'MEDICAL':'AUTO';
   const proposal=await prepareAreaWrite(raw,'prospectos',{clientId:sharedClient.id,line,ownerEmail:recipient,source:'Referido interno'},actor);
   assert.equal(proposal.clientId,sharedClient.id);assert.equal(proposal.ownerEmail,recipient);assert.equal(proposal.name,sharedClient.name);referralValidated=true;
  }
  output.push({areas:grant.productLines,defaultLine:defaultLine(actor),visiblePolicies:policies.length,visibleProspects:prospects.length,sharedContacts:contacts,sharedProducts:products,foreignOperationsBlocked:!!foreign,whatsAppPrivate:true,referralValidated});
 }
 console.log(JSON.stringify({productionReadChecks:'passed',brokers:output}));
}catch(error){console.error('PRODUCTION_SCOPE_CHECK_FAILED',error instanceof Error?error.message:'unknown');process.exitCode=1;}finally{await raw.$disconnect();}
