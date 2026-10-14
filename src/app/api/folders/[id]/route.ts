import { NextResponse } from 'next/server';
import { authenticate, apiError } from '@/lib/api';
import { getDb } from '@/lib/db';
import { folderPatch } from '@/modules/documentos/folders';
import { recordEvent } from '@/modules/events';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };
// Renames and/or recolors a folder, guarded by expectedUpdatedAt so a teammate's change is never overwritten.
export async function PATCH(request: Request, { params }: Context) {
  const auth = await authenticate(request, 'ADMIN'); if (auth.denied) return auth.denied;
  try {
    const { id } = await params;
    const input = folderPatch.parse(await request.json());
    const db = getDb();
    const result = await db.documentFolder.updateMany({ where: { id, updatedAt: new Date(input.expectedUpdatedAt) }, data: { name: input.name, color: input.color } });
    if (!result.count) {
      const exists = await db.documentFolder.count({ where: { id } });
      return NextResponse.json({ error: exists ? 'RECORD_CHANGED' : 'FOLDER_NOT_FOUND' }, { status: exists ? 409 : 404 });
    }
    const folder = await db.documentFolder.findUniqueOrThrow({ where: { id }, select: { name: true, color: true, updatedAt: true } });
    await recordEvent(auth.actor, input.name !== undefined ? 'renamed' : 'updated', 'carpetas', id, folder.name, input.color !== undefined ? { color: input.color } : undefined);
    return NextResponse.json({ data: { ...folder, updatedAt: folder.updatedAt.toISOString() } });
  } catch (error) { return apiError(error); }
}
// Only empty folders can be removed, including archived files and subfolders, so nothing is ever orphaned.
export async function DELETE(request: Request, { params }: Context) {
  const auth = await authenticate(request, 'ADMIN'); if (auth.denied) return auth.denied;
  try {
    const { id } = await params;
    const db = getDb();
    const folder = await db.documentFolder.findUnique({ where: { id }, select: { id: true, name: true, _count: { select: { children: true, documents: true } } } });
    if (!folder) return NextResponse.json({ error: 'FOLDER_NOT_FOUND' }, { status: 404 });
    if (folder._count.children || folder._count.documents) return NextResponse.json({ error: 'FOLDER_NOT_EMPTY' }, { status: 409 });
    await db.documentFolder.delete({ where: { id } });
    await recordEvent(auth.actor, 'deleted', 'carpetas', id, folder.name);
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
