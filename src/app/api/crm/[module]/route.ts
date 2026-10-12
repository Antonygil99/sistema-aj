import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authorize, apiError } from '@/lib/api';
import { services } from '@/modules/registry';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ module: string }> };
function lookup(key: string) { return Object.hasOwn(services, key) ? services[key as keyof typeof services] : undefined; }
export async function GET(request: Request, context: Context) {
  const denied = authorize(request); if (denied) return denied;
  const service = lookup((await context.params).module);
  if (!service) return NextResponse.json({ error: 'MODULE_NOT_FOUND' }, { status: 404 });
  try {
    const url = new URL(request.url);
    const take = z.coerce.number().int().min(1).max(100).parse(url.searchParams.get('take') ?? 20);
    const skip = z.coerce.number().int().min(0).max(100000).parse(url.searchParams.get('skip') ?? 0);
    return NextResponse.json(await service.list(take, skip));
  } catch (error) { return apiError(error); }
}
export async function POST(request: Request, context: Context) {
  const denied = authorize(request); if (denied) return denied;
  const service = lookup((await context.params).module);
  if (!service) return NextResponse.json({ error: 'MODULE_NOT_FOUND' }, { status: 404 });
  try { return NextResponse.json({ data: await service.create(await request.json()) }, { status: 201 }); }
  catch (error) { return apiError(error); }
}
