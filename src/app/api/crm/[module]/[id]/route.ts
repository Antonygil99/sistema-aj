import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, apiError } from '@/lib/api';
import { isResourceSlug, resources, type Row } from '@/modules/resources/config';
import { deleteResource, findResource, updateResource } from '@/modules/resources/server';
import { recordEvent } from '@/modules/events';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ module: string; id: string }> };
const noStore = { 'Cache-Control': 'no-store' };
const recordId = z.string().min(1).max(100);
const plain = (value: unknown) => JSON.parse(JSON.stringify(value)) as Row;
export async function GET(request: Request, context: Context) {
  const auth = await authenticate(request); if (auth.denied) return auth.denied;
  try {
    const { module, id } = await context.params;
    if (!isResourceSlug(module)) return NextResponse.json({ error: 'MODULE_NOT_FOUND' }, { status: 404 });
    const data = await findResource(module, recordId.parse(id));
    if (!data) return NextResponse.json({ error: 'RECORD_NOT_FOUND' }, { status: 404 });
    return NextResponse.json({ data }, { headers: noStore });
  } catch (error) { return apiError(error); }
}
export async function PATCH(request: Request, context: Context) {
  const auth = await authenticate(request, 'ADMIN'); if (auth.denied) return auth.denied;
  try {
    const { module, id } = await context.params;
    if (!isResourceSlug(module)) return NextResponse.json({ error: 'MODULE_NOT_FOUND' }, { status: 404 });
    const data = await updateResource(module, recordId.parse(id), await request.json());
    if (data) await recordEvent(auth.actor, 'updated', module, data.id, resources[module].title(plain(data)));
    return NextResponse.json({ data }, { headers: noStore });
  } catch (error) { return apiError(error); }
}
// Permanent deletion: superadmin only, and only for records without dependents.
export async function DELETE(request: Request, context: Context) {
  const auth = await authenticate(request, 'SUPERADMIN'); if (auth.denied) return auth.denied;
  try {
    const { module, id } = await context.params;
    if (!isResourceSlug(module)) return NextResponse.json({ error: 'MODULE_NOT_FOUND' }, { status: 404 });
    const data = await deleteResource(module, recordId.parse(id));
    await recordEvent(auth.actor, 'deleted', module, data.id, resources[module].title(plain(data)));
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (error) { return apiError(error); }
}
