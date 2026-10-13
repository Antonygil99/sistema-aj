import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authorize, apiError } from '@/lib/api';
import { services } from '@/modules/registry';
import { contactQuerySchema } from '@/modules/shared/contact-list';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ module: string }> };
function lookup(key: string) { return Object.hasOwn(services, key) ? services[key as keyof typeof services] : undefined; }
export async function GET(request: Request, context: Context) {
  const denied = await authorize(request); if (denied) return denied;
  const slug = (await context.params).module;
  const service = lookup(slug);
  if (!service) return NextResponse.json({ error: 'MODULE_NOT_FOUND' }, { status: 404 });
  try {
    const url = new URL(request.url);
    const take = z.coerce.number().int().min(1).max(100).parse(url.searchParams.get('take') ?? 20);
    const skip = z.coerce.number().int().min(0).max(100000).parse(url.searchParams.get('skip') ?? 0);
    if (slug === 'prospectos' || slug === 'clientes') {
      const query = contactQuerySchema.parse({ q: url.searchParams.get('q') ?? '', ...(url.searchParams.has('status') ? { status: url.searchParams.get('status') } : {}) });
      return NextResponse.json(await services[slug].list(take, skip, query), { headers: { 'Cache-Control': 'no-store' } });
    }
    return NextResponse.json(await service.list(take, skip), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}
export async function POST(request: Request, context: Context) {
  const denied = await authorize(request, 'ADMIN'); if (denied) return denied;
  const moduleSlug = (await context.params).module;
  // Only the verified upload flow may register stored documents.
  if (moduleSlug === 'documentos') return NextResponse.json({ error: 'USE_DOCUMENT_UPLOAD' }, { status: 405, headers: { Allow: 'GET' } });
  const service = lookup(moduleSlug);
  if (!service) return NextResponse.json({ error: 'MODULE_NOT_FOUND' }, { status: 404 });
  try { return NextResponse.json({ data: await service.create(await request.json()) }, { status: 201 }); }
  catch (error) { return apiError(error); }
}
