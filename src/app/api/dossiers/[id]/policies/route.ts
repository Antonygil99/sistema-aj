import { NextResponse } from 'next/server';
import { authorize, apiError } from '@/lib/api';
import { getDb } from '@/lib/db';
import { policyInput } from '@/modules/clientes/dossier-policy';
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await authorize(request, 'ADMIN'); if (denied) return denied;
  try { const { id } = await params; const { payments, ...policy } = policyInput.parse(await request.json());
    const data = await getDb().policy.create({ data: { ...policy, clientId: id, startDate: new Date(policy.startDate), endDate: new Date(policy.endDate), payments: { create: payments.map(p => ({ ...p, currency: policy.currency, dueDate: new Date(p.dueDate) })) } }, select: { id: true } });
    return NextResponse.json({ data }, { status: 201 });
  } catch(error) { return apiError(error); }
}
