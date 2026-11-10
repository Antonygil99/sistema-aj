import {authenticate,apiError} from '@/lib/api';
import {reviewQueue} from '@/modules/revision/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){
  const auth=await authenticate(request,'ADMIN');if(auth.denied)return auth.denied;
  try{return Response.json(await reviewQueue(Object.fromEntries(new URL(request.url).searchParams)),{headers:{'Cache-Control':'private, no-store'}});}
  catch(error){return apiError(error);}
}
