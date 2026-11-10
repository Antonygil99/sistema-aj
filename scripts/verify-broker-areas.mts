import 'dotenv/config';
import assert from 'node:assert/strict';
import {getDb} from '../src/lib/db';
import {getAreaDb} from '../src/modules/areas/db';
import {listResource} from '../src/modules/resources/server';
import {assertRecordArea} from '../src/modules/areas/server';
if(!process.argv[2]||!process.argv[3])throw Error('Use los correos de Autos y Salud/Vida como argumentos, en ese orden. Esta verificación solo consulta datos.');
const raw=getDb();
try{
 const output=[];
 for(const [email,areas]of [[process.argv[2],['AUTO']],[process.argv[3],['MEDICAL','LIFE','ACCIDENT']]] as const){
  const grant=await raw.accessGrant.findUniqueOrThrow({where:{email}});
  assert.deepEqual(grant.productLines,[...areas]);assert.equal(grant.enabled,true);
  const actor={role:grant.role,email:grant.email,productLines:grant.productLines},db=getAreaDb(actor);
  const [policies,prospects,contacts,products,sharedClient]=await Promise.all([
   db.policy.findMany({select:{id:true,line:true},where:{archivedAt:null}}),
   db.prospect.findMany({select:{id:true,line:true},where:{archivedAt:null}}),
   db.client.count(),db.product.count(),
   db.client.findFirst({include:{policies:{select:{id:true,line:true,payments:{select:{id:true}}}},convertedFrom:{select:{id:true,line:true}},opportunities:{select:{id:true,line:true}},_count:{select:{policies:true,referrals:true}}}}),
  ]);
  assert.ok(policies.every(p=>areas.includes(p.line as never)));assert.ok(prospects.every(p=>areas.includes(p.line as never)));
  assert.ok(sharedClient?.policies.every(p=>areas.includes(p.line as never)));
  const foreign=await raw.policy.findFirst({where:{line:{notIn:[...areas]}},select:{id:true}});
  if(foreign){assert.equal(await db.policy.findUnique({where:{id:foreign.id}}),null);await assert.rejects(()=>assertRecordArea(raw,'polizas',foreign.id,actor,true),{code:'RECORD_NOT_FOUND'});}
  for(const resource of ['prospectos','polizas','pagos','cotizaciones','clientes','productos'] as const)await listResource(resource,{take:2},actor);
  await db.$transaction(async tx=>{await tx.policy.count();await tx.client.count({where:{policies:{some:{status:'ACTIVE'}}}});});
  output.push({areas:grant.productLines,visiblePolicies:policies.length,visibleProspects:prospects.length,sharedContacts:contacts,sharedProducts:products,foreignOperationsBlocked:!!foreign});
 }
 console.log(JSON.stringify({productionReadChecks:'passed',brokers:output}));
}catch(error){console.error('PRODUCTION_SCOPE_CHECK_FAILED',error instanceof Error?error.message:'unknown');process.exitCode=1;}finally{await raw.$disconnect();}
