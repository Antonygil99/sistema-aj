import { authenticate } from '@/lib/api';
import { approveIntake } from '@/modules/intake/server';
import { intakeBody, intakeError, intakeJson } from '@/modules/intake/http';
export const runtime='nodejs';
export async function POST(request:Request,context:{params:Promise<{id:string}>}){const auth=await authenticate(request,'ADMIN');if(auth.denied)return auth.denied;try{await approveIntake((await context.params).id,await intakeBody(request),auth.actor);return intakeJson({saved:true});}catch(e){return intakeError(e);}}
