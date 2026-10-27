import { authenticate } from '@/lib/api';
import { staffIntake, submitIntake } from '@/modules/intake/server';
import { intakeBody, intakeError, intakeJson } from '@/modules/intake/http';
export const runtime='nodejs';
export async function GET(request:Request,context:{params:Promise<{id:string}>}){const auth=await authenticate(request,'ADMIN');if(auth.denied)return auth.denied;try{return intakeJson(await staffIntake((await context.params).id,auth.actor));}catch(e){return intakeError(e);}}
export async function POST(request:Request,context:{params:Promise<{id:string}>}){const auth=await authenticate(request,'ADMIN');if(auth.denied)return auth.denied;try{return intakeJson(await submitIntake((await context.params).id,await intakeBody(request),auth.actor));}catch(e){return intakeError(e);}}
