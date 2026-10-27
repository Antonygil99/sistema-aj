import { authenticate } from '@/lib/api';
import { rotateIntakeLink, revokeIntakeLink } from '@/modules/intake/server';
import { intakeError, intakeJson } from '@/modules/intake/http';
export const runtime='nodejs';
export async function POST(request:Request,context:{params:Promise<{id:string}>}){const auth=await authenticate(request,'ADMIN');if(auth.denied)return auth.denied;try{const result=await rotateIntakeLink((await context.params).id,auth.actor);const base=new URL('/completar',process.env.BETTER_AUTH_URL!);base.hash=result.token;return intakeJson({url:base.toString(),pin:result.pin,expiresAt:result.expiresAt});}catch(e){return intakeError(e);}}
export async function DELETE(request:Request,context:{params:Promise<{id:string}>}){const auth=await authenticate(request,'ADMIN');if(auth.denied)return auth.denied;try{await revokeIntakeLink((await context.params).id,auth.actor);return intakeJson({saved:true});}catch(e){return intakeError(e);}}
