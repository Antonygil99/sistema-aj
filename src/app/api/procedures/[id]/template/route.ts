import { authenticate } from '@/lib/api';
import { procedureAccess, templateBytes } from '@/modules/procedures/server';
import { intakeError, privateHeaders } from '@/modules/intake/http';
export const runtime='nodejs';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){const auth=await authenticate(request,'ADMIN');if(auth.denied)return auth.denied;try{await procedureAccess((await params).id,auth.actor);return new Response(Buffer.from(await templateBytes()),{headers:{...privateHeaders,'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="MetLife-IG-2-020-VER11-original.pdf"'}});}catch(e){return intakeError(e);}}
