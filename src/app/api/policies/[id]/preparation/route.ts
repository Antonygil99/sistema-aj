import {authenticate,apiError} from '@/lib/api';
import {renewalPreparation,saveRenewalPreparation} from '@/modules/renovaciones/preparation-server';
type Context={params:Promise<{id:string}>};
export async function GET(request:Request,ctx:Context){const auth=await authenticate(request);if(auth.denied)return auth.denied;try{return Response.json(await renewalPreparation((await ctx.params).id,auth.actor,request.headers),{headers:{'Cache-Control':'private, no-store'}});}catch(e){return apiError(e);}}
export async function POST(request:Request,ctx:Context){const auth=await authenticate(request,'ADMIN');if(auth.denied)return auth.denied;try{return Response.json(await saveRenewalPreparation((await ctx.params).id,await request.json(),auth.actor,request.headers));}catch(e){return apiError(e);}}
