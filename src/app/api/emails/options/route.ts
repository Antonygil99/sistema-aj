import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, apiError } from '@/lib/api';
import { emailOptions } from '@/modules/email/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// What the composer offers for one client: allowed recipients, attachable documents and the last welcome.
export async function GET(request: Request) {
  const auth = await authenticate(request, 'ADMIN'); if (auth.denied) return auth.denied;
  try {
    const clientId = z.string().min(1).max(100).parse(new URL(request.url).searchParams.get('clientId'));
    return NextResponse.json({ data: await emailOptions(clientId) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return apiError(error); }
}
