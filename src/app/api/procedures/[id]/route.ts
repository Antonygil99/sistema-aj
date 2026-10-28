import { authenticate } from '@/lib/api';
import { procedureAccess, saveProcedureDraft } from '@/modules/procedures/server';
import { intakeBody, intakeError, intakeJson } from '@/modules/intake/http';
export const runtime='nodejs';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){const auth=await authenticate(request,'ADMIN');if(auth.denied)return auth.denied;try{return intakeJson(await procedureAccess((await params).id,auth.actor));}catch(e){return intakeError(e);}}
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){const auth=await authenticate(request,'ADMIN');if(auth.denied)return auth.denied;try{return intakeJson(await saveProcedureDraft((await params).id,await intakeBody(request),auth.actor));}catch(e){return intakeError(e);}}
