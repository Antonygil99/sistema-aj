import { NextResponse } from 'next/server';
import { authorize, apiError } from '@/lib/api';
import { getDb } from '@/lib/db';
import { folderInput, folderScope } from '@/modules/documentos/folders';
import { FileError } from '@/modules/documentos/file-policy';
export async function POST(request: Request) {
  const denied = await authorize(request,'ADMIN'); if (denied) return denied;
  try { const input = folderInput.parse(await request.json()); await folderScope(input.parentId,input.clientId); const data = await getDb().documentFolder.create({ data: input }); return NextResponse.json({ data },{ status:201 }); }
  catch(error) { if(error instanceof FileError) return NextResponse.json({error:error.code},{status:error.status}); return apiError(error); }
}
