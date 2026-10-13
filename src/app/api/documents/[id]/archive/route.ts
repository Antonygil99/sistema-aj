import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, apiError } from '@/lib/api';
import { getDb } from '@/lib/db';
import { recordEvent } from '@/modules/events';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Archived files disappear from the libraries but keep their stored object and can be restored.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticate(request, 'ADMIN'); if (auth.denied) return auth.denied;
  try {
    const id = z.string().min(1).max(100).parse((await params).id);
    const { archived } = z.object({ archived: z.boolean() }).strict().parse(await request.json());
    const db = getDb();
    const result = await db.document.updateMany({ where: { id, archivedAt: archived ? null : { not: null } }, data: { archivedAt: archived ? new Date() : null } });
    const doc = await db.document.findUnique({ where: { id }, select: { id: true, name: true } });
    if (!doc) return NextResponse.json({ error: 'DOCUMENT_NOT_FOUND' }, { status: 404 });
    if (!result.count) return NextResponse.json({ error: 'ALREADY_IN_STATE' }, { status: 409 });
    await recordEvent(auth.actor, archived ? 'archived' : 'restored', 'documentos', id, doc.name);
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}
