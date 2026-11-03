import {apiError} from '@/lib/api';
import {driveUser,driveCredentials,noStore} from '@/modules/drive/server';
import {driveId,keySchema} from '@/modules/drive/rules';
export async function GET(request:Request){const auth=await driveUser(request);if(auth.denied)return auth.denied;try{const q=new URL(request.url).searchParams,id=driveId.parse(q.get('id')),key=q.has('key')?keySchema.parse(q.get('key')):null;const {google}=await driveCredentials(auth.actor.id,request.headers);const result=await google.thumbnail(id,key);return new Response(new Uint8Array(result.bytes),{headers:{...noStore,'Content-Type':result.type,'X-Content-Type-Options':'nosniff'}});}catch(e){const response=apiError(e);response.headers.set('Cache-Control','private, no-store');return response;}}
