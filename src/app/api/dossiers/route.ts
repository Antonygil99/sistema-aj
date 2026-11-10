import {getAreaDb} from '@/modules/areas/db';
import {NextResponse} from 'next/server';
import {authenticate,apiError} from '@/lib/api';
import {recordEvent} from '@/modules/events';
import {dossierInput} from '@/modules/clientes/dossier-policy';
import {conversionProspect,finishConversion,createDossierPolicy} from '@/modules/clientes/prospect-conversion';
import {ResourceError} from '@/modules/resources/rules';
export async function POST(request:Request){
 const auth=await authenticate(request,'ADMIN');if(auth.denied)return auth.denied;
 try{
  const input=dossierInput.parse(await request.json());
  const data=await getAreaDb(auth.actor).$transaction(async tx=>{
   const prospect=await conversionProspect(tx,input.prospectId,auth.actor);
   // Existing contact data remains authoritative; an opportunity never duplicates it.
   const client=prospect?.clientId?await tx.client.findFirst({where:{id:prospect.clientId,archivedAt:null}}):await tx.client.create({data:input.client});
   if(!client)throw new ResourceError('RECORD_NOT_FOUND',404);
   if(!prospect?.clientId)await tx.documentFolder.createMany({data:['Identificación','Pólizas','Pagos','Siniestros'].map(name=>({name,clientId:client.id}))});
   const policy=input.policy?await createDossierPolicy(tx,client.id,input.policy,auth.actor,prospect):null;
   if(prospect)await finishConversion(tx,prospect.id,client.id);
   return {id:client.id,name:client.name,prospectId:prospect?.id,policyId:policy?.id??null,reused:!!prospect?.clientId};
  });
  await recordEvent(auth.actor,data.reused?'updated':'created','expedientes',data.id,data.name);
  if(data.prospectId)await recordEvent(auth.actor,'updated','prospectos',data.prospectId,'Oportunidad incorporada al expediente');
  return NextResponse.json({data:{id:data.id,policyId:data.policyId}},{status:201});
 }catch(error){return apiError(error);}
}
