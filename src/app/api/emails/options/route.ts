import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, apiError } from '@/lib/api';
import { emailOptions } from '@/modules/email/server';
import { templateKinds } from '@/modules/email/template-text';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// What the composer offers for one client: allowed recipients, attachable documents and the last welcome.
export async function GET(request: Request) {
  const auth = await authenticate(request, 'ADMIN'); if (auth.denied) return auth.denied;
  try {
    const params = new URL(request.url).searchParams;
    const clientId = z.string().min(1).max(100).parse(params.get('clientId'));
    const kind = z.enum(templateKinds).default('DOCUMENTOS').parse(params.get('kind') ?? undefined);
    const noticeId = z.string().min(1).max(100).nullable().parse(params.get('noticeId'));
    return NextResponse.json({ data: await emailOptions(clientId, { kind, noticeId, actor: auth.actor }) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return apiError(error); }
}
