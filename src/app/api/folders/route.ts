import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, authorize, apiError } from '@/lib/api';
import { getDb } from '@/lib/db';
import { folderInput, folderScope, folderSelect } from '@/modules/documentos/folders';
import { recordEvent } from '@/modules/events';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Archived folders of one library (the team's, or a client's with ?clientId=), newest first, to restore them.
export async function GET(request: Request) {
  const denied = await authorize(request); if (denied) return denied;
  try {
    const url = new URL(request.url);
    const clientId = z.string().min(1).max(100).nullable().parse(url.searchParams.get('clientId'));
    const folders = await getDb().documentFolder.findMany({ where: { clientId, archivedAt: { not: null } }, orderBy: { archivedAt: 'desc' }, take: 100, select: { ...folderSelect, archivedAt: true } });
    return NextResponse.json({ data: folders }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}
export async function POST(request: Request) {
  const auth = await authenticate(request, 'ADMIN'); if (auth.denied) return auth.denied;
  try {
    const input = folderInput.parse(await request.json());
    await folderScope(input.parentId, input.clientId);
    const data = await getDb().documentFolder.create({ data: input });
    await recordEvent(auth.actor, 'created', 'carpetas', data.id, data.name);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) { return apiError(error); }
}
