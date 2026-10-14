import { NextResponse } from 'next/server';
import { authenticate, apiError } from '@/lib/api';
import { listTemplates } from '@/modules/email/notices-server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const auth = await authenticate(request, 'ADMIN'); if (auth.denied) return auth.denied;
  try { return NextResponse.json({ data: await listTemplates() }, { headers: { 'Cache-Control': 'private, no-store' } }); }
  catch (error) { return apiError(error); }
}
