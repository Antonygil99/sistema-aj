import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, apiError } from '@/lib/api';
import { getDb } from '@/lib/db';
import { getR2 } from '@/integrations/r2/server';
import { FileError, isManagedKey } from '@/modules/documentos/file-policy';
import { folderScope } from '@/modules/documentos/folders';
import { recordEvent } from '@/modules/events';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };
const noStore = { 'Cache-Control': 'no-store' };
function failure(error: unknown) {
  if (error instanceof FileError) return NextResponse.json({ error: error.code }, { status: error.status, headers: noStore });
  return apiError(error);
}
// Move a file between folders of its library; its link to the dossier never changes.
export async function PATCH(request: Request, { params }: Context) {
  const auth = await authenticate(request, 'ADMIN'); if (auth.denied) return auth.denied;
  try {
    const { id } = await params;
    const input = z.object({ folderId: z.string().min(1).max(100).nullable(), clientId: z.string().min(1).max(100).nullable(), expectedUpdatedAt: z.iso.datetime() }).strict().parse(await request.json());
    await folderScope(input.folderId, input.clientId);
    const db = getDb();
    const doc = await db.document.findUnique({ where: { id }, include: { policy: { select: { clientId: true } }, claim: { include: { policy: { select: { clientId: true } } } } } });
    if (!doc) return NextResponse.json({ error: 'DOCUMENT_NOT_FOUND' }, { status: 404 });
    const owner = doc.clientId ?? doc.policy?.clientId ?? doc.claim?.policy.clientId ?? null;
    if (input.clientId !== null && input.clientId !== owner) throw new FileError('FOLDER_SCOPE_MISMATCH', 422);
    const result = await db.document.updateMany({ where: { id, updatedAt: new Date(input.expectedUpdatedAt) }, data: { folderId: input.folderId } });
    if (!result.count) return NextResponse.json({ error: 'RECORD_CHANGED' }, { status: 409 });
    await recordEvent(auth.actor, 'moved', 'documentos', id, doc.name);
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (error) { return failure(error); }
}
// Permanent deletion (superadmin): the row goes first, then the stored object.
export async function DELETE(request: Request, { params }: Context) {
  const auth = await authenticate(request, 'SUPERADMIN'); if (auth.denied) return auth.denied;
  try {
    const { id } = await params;
    const db = getDb();
    const doc = await db.document.findUnique({ where: { id }, select: { id: true, name: true, storageKey: true } });
    if (!doc) return NextResponse.json({ error: 'DOCUMENT_NOT_FOUND' }, { status: 404 });
    await db.document.delete({ where: { id } });
    if (isManagedKey(doc.storageKey)) await getR2().remove(doc.storageKey).catch(() => console.error('R2_ORPHAN_CLEANUP_REQUIRED'));
    await recordEvent(auth.actor, 'deleted', 'documentos', id, doc.name);
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (error) { return failure(error); }
}
