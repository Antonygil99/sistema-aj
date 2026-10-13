import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, apiError } from '@/lib/api';
import { deliveryCard, updateDelivery } from '@/modules/polizas/delivery-server';
import { recordEvent } from '@/modules/events';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };
const noStore = { 'Cache-Control': 'no-store' };
const policyId = z.string().min(1).max(100);
export async function GET(request: Request, { params }: Context) {
  const auth = await authenticate(request); if (auth.denied) return auth.denied;
  try {
    const data = await deliveryCard(policyId.parse((await params).id));
    if (!data) return NextResponse.json({ error: 'RECORD_NOT_FOUND' }, { status: 404, headers: noStore });
    return NextResponse.json({ data }, { headers: noStore });
  } catch (error) { return apiError(error); }
}
// Active delivery checklist, delivery date, referral flag and follow-up completion (ADMIN).
export async function PATCH(request: Request, { params }: Context) {
  const auth = await authenticate(request, 'ADMIN'); if (auth.denied) return auth.denied;
  try {
    const data = await updateDelivery(policyId.parse((await params).id), await request.json());
    if (data) await recordEvent(auth.actor, 'updated', 'entregas', data.id, data.number);
    return NextResponse.json({ data }, { headers: noStore });
  } catch (error) { return apiError(error); }
}
