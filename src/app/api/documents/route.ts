import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, authorize, apiError } from '@/lib/api';
import { recordEvent } from '@/modules/events';
import { getDb } from '@/lib/db';
import { getDocumentFiles } from '@/modules/documentos/files';
import { attachmentSchema, boundedFormData, FileError } from '@/modules/documentos/file-policy';
import { documentSelect, folderScope, scopeWhere } from '@/modules/documentos/folders';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function GET(request: Request) {
  const denied = await authorize(request); if (denied) return denied;
  try {
    const url = new URL(request.url);
    const take = z.coerce.number().int().min(1).max(100).parse(url.searchParams.get('take') ?? 20);
    const skip = z.coerce.number().int().min(0).max(100000).parse(url.searchParams.get('skip') ?? 0);
    const query = z.string().trim().max(100).parse(url.searchParams.get('q') ?? '');
    const folderId = z.string().max(100).nullable().parse(url.searchParams.get('folderId'));
    const clientId = z.string().max(100).nullable().parse(url.searchParams.get('clientId'));
    await folderScope(folderId, clientId);
    const where = { ...scopeWhere(clientId), folderId, archivedAt: null, ...(query ? { name: { contains: query, mode: 'insensitive' as const } } : {}) };
    const [data, total] = await getDb().$transaction([
      getDb().document.findMany({ where, take, skip, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: documentSelect }),
      getDb().document.count({ where }),
    ]);
    const folders = await getDb().documentFolder.findMany({ where: { clientId }, orderBy: { name:'asc' } });
    return NextResponse.json({ data, folders, total, take, skip }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { if(error instanceof FileError)return NextResponse.json({error:error.code},{status:error.status});return apiError(error); }
}
export async function POST(request: Request) {
  const auth = await authenticate(request, 'ADMIN'); if (auth.denied) return auth.denied;
  try {
    const form = await boundedFormData(request);
    if ([...form.keys()].some(key => !['file', 'clientId', 'policyId', 'claimId','folderId'].includes(key)) || [...new Set(form.keys())].some(key => form.getAll(key).length !== 1)) throw new FileError('FORM_INVALID', 400);
    const file = form.get('file');
    if (!(file instanceof File)) throw new FileError('FILE_REQUIRED', 400);
    const attachment = attachmentSchema.parse(Object.fromEntries(['clientId', 'policyId', 'claimId'].filter(key => form.has(key)).map(key => [key, form.get(key)])));
    const folderId = z.string().min(1).max(100).optional().parse(form.get('folderId') ?? undefined);
    if(folderId) { const folder=await getDb().documentFolder.findUnique({where:{id:folderId}}); if(!folder)throw new FileError('FOLDER_NOT_FOUND',404);
      const clientId=attachment.clientId ?? (attachment.policyId ? (await getDb().policy.findUnique({where:{id:attachment.policyId},select:{clientId:true}}))?.clientId : attachment.claimId ? (await getDb().claim.findUnique({where:{id:attachment.claimId},include:{policy:{select:{clientId:true}}}}))?.policy.clientId : null);
      if(folder.clientId && folder.clientId!==clientId)throw new FileError('FOLDER_SCOPE_MISMATCH',422);
    }
    const data = await getDocumentFiles(folderId).upload({ name: file.name, mimeType: file.type, body: new Uint8Array(await file.arrayBuffer()), attachment });
    await recordEvent(auth.actor, 'uploaded', 'documentos', data.id, data.name);
    // Do not return bucket paths or a permanent public URL to the browser.
    return NextResponse.json({ data: { id: data.id, name: data.name, mimeType: data.mimeType } }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof FileError) return NextResponse.json({ error: error.code }, { status: error.status });
    return apiError(error);
  }
}
