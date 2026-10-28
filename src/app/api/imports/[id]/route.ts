import { z } from 'zod';
import { human } from '@/modules/mcp/human';
import { getBatch, editBatchRow, applyBatch } from '@/modules/imports/server';
import { contactRowSchema } from '@/modules/imports/rules';
import { importJson } from '@/modules/imports/http';
import { apiError } from '@/lib/api';
export const runtime='nodejs';
export const maxDuration=60;
const cache={'Cache-Control':'private, no-store'};
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{return Response.json(await getBatch(await human(request),(await params).id),{headers:cache});}catch(error){return apiError(error);}}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const actor=await human(request),{id}=await params;
    const input=z.discriminatedUnion('action',[
      z.object({action:z.literal('edit'),rowId:z.string().min(1).max(100),expectedUpdatedAt:z.iso.datetime({offset:true}),data:contactRowSchema,allowNameMatch:z.boolean().default(false)}).strict(),
      z.object({action:z.literal('apply'),expectedUpdatedAt:z.iso.datetime({offset:true}),selectedIds:z.array(z.string().min(1).max(100)).min(1).max(500),reviewed:z.literal(true)}).strict(),
      z.object({action:z.literal('cancel'),expectedUpdatedAt:z.iso.datetime({offset:true})}).strict(),
    ]).parse(await importJson(request));
    const result=input.action==='edit'?await editBatchRow(actor,id,input):await applyBatch(actor,id,input.action==='cancel'?{expectedUpdatedAt:input.expectedUpdatedAt,selectedIds:[],reviewed:false,cancel:true}:input);
    return Response.json(result,{headers:cache});
  }catch(error){return apiError(error);}
}
