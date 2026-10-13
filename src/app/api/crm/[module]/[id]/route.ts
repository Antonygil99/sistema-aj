import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authorize, apiError } from '@/lib/api';
import * as prospects from '@/modules/prospectos/service';
import * as clients from '@/modules/clientes/service';
import { ContactError } from '@/modules/shared/contact-update';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ module: string; id: string }> };
function service(slug: string) { return slug === 'prospectos' ? prospects : slug === 'clientes' ? clients : null; }
export async function GET(request: Request, context: Context) {
  const denied = await authorize(request); if (denied) return denied;
  try {
    const params = await context.params;
    const moduleService = service(params.module);
    if (!moduleService) return NextResponse.json({ error: 'MODULE_NOT_FOUND' }, { status: 404 });
    const data = await moduleService.find(z.string().min(1).max(100).parse(params.id));
    if (!data) return NextResponse.json({ error: 'RECORD_NOT_FOUND' }, { status: 404 });
    return NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}
export async function PATCH(request: Request, context: Context) {
  const denied = await authorize(request, 'ADMIN'); if (denied) return denied;
  try {
    const params = await context.params;
    const moduleService = service(params.module);
    if (!moduleService) return NextResponse.json({ error: 'MODULE_NOT_FOUND' }, { status: 404 });
    const data = await moduleService.update(z.string().min(1).max(100).parse(params.id), await request.json());
    return NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof ContactError) return NextResponse.json({ error: error.code }, { status: error.status });
    return apiError(error);
  }
}
