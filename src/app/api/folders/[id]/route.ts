import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, apiError } from '@/lib/api';
import { getDb } from '@/lib/db';
import { folderName } from '@/modules/documentos/folders';
import { recordEvent } from '@/modules/events';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, { params }: Context) {
  const auth = await authenticate(request, 'ADMIN'); if (auth.denied) return auth.denied;
  try {
    const { id } = await params;
    const input = z.object({ name: folderName, expectedUpdatedAt: z.iso.datetime() }).strict().parse(await request.json());
    const result = await getDb().documentFolder.updateMany({ where: { id, updatedAt: new Date(input.expectedUpdatedAt) }, data: { name: input.name } });
    if (!result.count) return NextResponse.json({ error: 'RECORD_CHANGED' }, { status: 409 });
    await recordEvent(auth.actor, 'renamed', 'carpetas', id, input.name);
    return NextResponse.json({ ok: true });
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
