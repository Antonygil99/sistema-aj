import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authorize, apiError } from '@/lib/api';
import { getDb } from '@/lib/db';
import { getDocumentFiles } from '@/modules/documentos/files';
import { attachmentSchema, boundedFormData, FileError } from '@/modules/documentos/file-policy';
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
    const where = query ? { name: { contains: query, mode: 'insensitive' as const } } : {};
    const [data, total] = await getDb().$transaction([
      getDb().document.findMany({ where, take, skip, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true, name: true, mimeType: true, createdAt: true, client: { select: { name: true } }, policy: { select: { number: true } }, claim: { select: { reference: true } } } }),
      getDb().document.count({ where }),
    ]);
    return NextResponse.json({ data, total, take, skip }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}
export async function POST(request: Request) {
  const denied = await authorize(request, 'ADMIN'); if (denied) return denied;
  try {
    const form = await boundedFormData(request);
    if ([...form.keys()].some(key => !['file', 'clientId', 'policyId', 'claimId'].includes(key)) || [...new Set(form.keys())].some(key => form.getAll(key).length !== 1)) throw new FileError('FORM_INVALID', 400);
    const file = form.get('file');
    if (!(file instanceof File)) throw new FileError('FILE_REQUIRED', 400);
    const attachment = attachmentSchema.parse(Object.fromEntries(['clientId', 'policyId', 'claimId'].filter(key => form.has(key)).map(key => [key, form.get(key)])));
    const data = await getDocumentFiles().upload({ name: file.name, mimeType: file.type, body: new Uint8Array(await file.arrayBuffer()), attachment });
    // Do not return bucket paths or a permanent public URL to the browser.
    return NextResponse.json({ data: { id: data.id, name: data.name, mimeType: data.mimeType } }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof FileError) return NextResponse.json({ error: error.code }, { status: error.status });
    return apiError(error);
  }
}
