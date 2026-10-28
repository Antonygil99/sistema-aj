import { authenticate } from '@/lib/api';
import { addProcedureAttachment } from '@/modules/procedures/server';
import { intakeBody, intakeError, intakeJson } from '@/modules/intake/http';
export const runtime='nodejs';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){const auth=await authenticate(request,'ADMIN');if(auth.denied)return auth.denied;try{return intakeJson(await addProcedureAttachment((await params).id,await intakeBody(request),auth.actor));}catch(e){return intakeError(e);}}
