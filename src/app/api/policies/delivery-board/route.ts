import { NextResponse } from 'next/server';
import { authenticate, apiError } from '@/lib/api';
import { deliveryBoard } from '@/modules/polizas/delivery-server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Every active policy with its delivery stage; the board filters by responsible in the browser.
export async function GET(request: Request) {
  const auth = await authenticate(request); if (auth.denied) return auth.denied;
  try { return NextResponse.json({ data: await deliveryBoard() }, { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { return apiError(error); }
}
