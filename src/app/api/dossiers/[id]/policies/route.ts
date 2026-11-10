import {getAreaDb} from '@/modules/areas/db';
import {NextResponse} from 'next/server';
import {authenticate,apiError} from '@/lib/api';
import {recordEvent} from '@/modules/events';
import {policyInput} from '@/modules/clientes/dossier-policy';
import {conversionProspect,finishConversion,createDossierPolicy} from '@/modules/clientes/prospect-conversion';
import {z} from 'zod';
const inputSchema=policyInput.safeExtend({prospectId:z.string().min(1).max(100).optional()});
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 const auth=await authenticate(request,'ADMIN');if(auth.denied)return auth.denied;
 try{
  const {id}=await params,{prospectId,...input}=inputSchema.parse(await request.json());
  const data=await getAreaDb(auth.actor).$transaction(async tx=>{
   const prospect=await conversionProspect(tx,prospectId,auth.actor,id);
   const policy=await createDossierPolicy(tx,id,input,auth.actor,prospect);
   if(prospect)await finishConversion(tx,prospect.id,id);
   return policy;
  });
  await recordEvent(auth.actor,'created','polizas',data.id,data.number);
  if(prospectId)await recordEvent(auth.actor,'updated','prospectos',prospectId,'Oportunidad incorporada al expediente existente');
  return NextResponse.json({data},{status:201});
 }catch(error){return apiError(error);}
}
