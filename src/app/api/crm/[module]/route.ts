import { NextResponse } from 'next/server';
import { authenticate, apiError } from '@/lib/api';
import { list as listDocuments } from '@/modules/documentos/service';
import { isResourceSlug, resources } from '@/modules/resources/config';
import { createResource, listResource } from '@/modules/resources/server';
import { redact } from '@/modules/resources/rules';
import { recordEvent } from '@/modules/events';
import type { Row } from '@/modules/resources/config';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ module: string }> };
const noStore = { 'Cache-Control': 'no-store' };
export async function GET(request: Request, context: Context) {
  const auth = await authenticate(request); if (auth.denied) return auth.denied;
  const slug = (await context.params).module;
  try {
    const params = Object.fromEntries(new URL(request.url).searchParams);
    if (slug === 'documentos') return NextResponse.json(await listDocuments(Number(params.take ?? 20) || 20, Number(params.skip ?? 0) || 0), { headers: noStore });
    if (!isResourceSlug(slug)) return NextResponse.json({ error: 'MODULE_NOT_FOUND' }, { status: 404 });
    const result = await listResource(slug, params);
    return NextResponse.json({ ...result, data: result.data.map(row => redact(slug, row, auth.actor.role)) }, { headers: noStore });
  } catch (error) { return apiError(error); }
}
export async function POST(request: Request, context: Context) {
  const auth = await authenticate(request, 'ADMIN'); if (auth.denied) return auth.denied;
  const slug = (await context.params).module;
  // Only the verified upload flow may register stored documents.
  if (slug === 'documentos') return NextResponse.json({ error: 'USE_DOCUMENT_UPLOAD' }, { status: 405, headers: { Allow: 'GET' } });
  if (!isResourceSlug(slug)) return NextResponse.json({ error: 'MODULE_NOT_FOUND' }, { status: 404 });
  try {
    const data = await createResource(slug, await request.json());
    await recordEvent(auth.actor, 'created', slug, data.id, resources[slug].title(JSON.parse(JSON.stringify(data)) as Row));
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) { return apiError(error); }
}
