import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authorize, apiError } from '@/lib/api';
import { getDb } from '@/lib/db';
import { folderName } from '@/modules/documentos/folders';
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}) {
  const denied=await authorize(request,'ADMIN');if(denied)return denied;
  try { const {id}=await params; const input=z.object({name:folderName,expectedUpdatedAt:z.iso.datetime()}).strict().parse(await request.json()); const result=await getDb().documentFolder.updateMany({where:{id,updatedAt:new Date(input.expectedUpdatedAt)},data:{name:input.name}}); if(!result.count)return NextResponse.json({error:'RECORD_CHANGED'},{status:409}); return NextResponse.json({ok:true}); } catch(error){return apiError(error);}
}
