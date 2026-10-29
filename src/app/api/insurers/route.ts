import {authenticate,apiError} from '@/lib/api';import {getDb} from '@/lib/db';
export async function GET(request:Request){const a=await authenticate(request);if(a.denied)return a.denied;try{return Response.json({data:await getDb().insurer.findMany({select:{id:true,name:true},orderBy:{name:'asc'}})},{headers:{'Cache-Control':'private, no-store'}});}catch(e){return apiError(e);}}
