import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, apiError } from '@/lib/api';
import { listNotices, refreshNotices } from '@/modules/email/notices-server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Client notices: pending ones (fresh: refreshed on every read) or those resolved in the last 14 days.
export async function GET(request: Request) {
  const auth = await authenticate(request); if (auth.denied) return auth.denied;
  try {
    const params = new URL(request.url).searchParams;
    const scope = z.enum(['mine', 'all']).default('mine').parse(params.get('scope') ?? undefined);
    const resolved = params.get('resolved') === '1';
    if (!resolved) await refreshNotices();
    return NextResponse.json({ data: await listNotices({ scope, email: auth.actor.email, resolved }) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return apiError(error); }
}
