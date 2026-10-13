import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authorize, apiError } from '@/lib/api';
import { getDb } from '@/lib/db';
import { FileError } from '@/modules/documentos/file-policy';
import { folderScope } from '@/modules/documentos/folders';
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}) {
  const denied=await authorize(request,'ADMIN');if(denied)return denied;
  try { const {id}=await params; const input=z.object({folderId:z.string().min(1).max(100).nullable(),clientId:z.string().min(1).max(100).nullable(),expectedUpdatedAt:z.iso.datetime()}).strict().parse(await request.json());
    await folderScope(input.folderId,input.clientId);
    const db=getDb(); const doc=await db.document.findUnique({where:{id},include:{policy:{select:{clientId:true}},claim:{include:{policy:{select:{clientId:true}}}}}});
    if(!doc)return NextResponse.json({error:'DOCUMENT_NOT_FOUND'},{status:404});
    const owner=doc.clientId??doc.policy?.clientId??doc.claim?.policy.clientId??null;
    if(input.clientId!==null && input.clientId!==owner) throw new FileError('FOLDER_SCOPE_MISMATCH',422);
    const result=await db.document.updateMany({where:{id,updatedAt:new Date(input.expectedUpdatedAt)},data:{folderId:input.folderId}});
    if(!result.count)return NextResponse.json({error:'RECORD_CHANGED'},{status:409}); return NextResponse.json({ok:true});
  }catch(error){if(error instanceof FileError)return NextResponse.json({error:error.code},{status:error.status});return apiError(error);}
}
