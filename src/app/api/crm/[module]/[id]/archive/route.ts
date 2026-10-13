import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, apiError } from '@/lib/api';
import { isResourceSlug, resources, type Row } from '@/modules/resources/config';
import { archiveResource } from '@/modules/resources/server';
import { recordEvent } from '@/modules/events';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Archiving hides a record without breaking its history; restoring brings it back unchanged.
export async function POST(request: Request, context: { params: Promise<{ module: string; id: string }> }) {
  const auth = await authenticate(request, 'ADMIN'); if (auth.denied) return auth.denied;
  try {
    const { module, id } = await context.params;
    if (!isResourceSlug(module)) return NextResponse.json({ error: 'MODULE_NOT_FOUND' }, { status: 404 });
    const { archived } = z.object({ archived: z.boolean() }).strict().parse(await request.json());
    const data = await archiveResource(module, z.string().min(1).max(100).parse(id), archived);
    if (data) await recordEvent(auth.actor, archived ? 'archived' : 'restored', module, data.id, resources[module].title(JSON.parse(JSON.stringify(data)) as Row));
    return NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}
