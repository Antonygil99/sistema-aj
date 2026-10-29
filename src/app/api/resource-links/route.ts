import {authenticate,apiError} from '@/lib/api';
import {getDb} from '@/lib/db';
import {resourceLinkSchema} from '@/modules/resource-links/rules';
import {ResourceError} from '@/modules/resources/rules';
import {recordEvent} from '@/modules/events';
export async function GET(request:Request){const auth=await authenticate(request);if(auth.denied)return auth.denied;try{return Response.json({rows:await getDb().crmResourceLink.findMany({where:auth.actor.role==='USER'?{active:true}:{},orderBy:[{category:'asc'},{title:'asc'}],take:200})},{headers:{'Cache-Control':'private, no-store'}});}catch(e){return apiError(e);}}
export async function POST(request:Request){const auth=await authenticate(request,'ADMIN');if(auth.denied)return auth.denied;try{
  if(!auth.actor.id)throw new ResourceError('FORBIDDEN',403);
  const {id,expectedUpdatedAt,publicReviewed,...data}=resourceLinkSchema.parse(await request.json());void publicReviewed;
  const db=getDb();
  const row=await db.$transaction(async tx=>{
    if(id){if(!expectedUpdatedAt)throw new ResourceError('RECORD_CHANGED',409);const r=await tx.crmResourceLink.updateMany({where:{id,updatedAt:new Date(expectedUpdatedAt)},data});if(!r.count)throw new ResourceError('RECORD_CHANGED',409);return tx.crmResourceLink.findUniqueOrThrow({where:{id}});}
    return tx.crmResourceLink.create({data:{...data,createdBy:auth.actor.id!}});
  });
  await recordEvent(auth.actor,id?'updated':'created','recursos',row.id,row.title);
  return Response.json(row,{headers:{'Cache-Control':'private, no-store'}});
}catch(e){return apiError(e);}}
