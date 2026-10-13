import { NextResponse } from 'next/server';
import { authenticate, apiError } from '@/lib/api';
import { recordEvent } from '@/modules/events';
import { getDb } from '@/lib/db';
import { policyInput } from '@/modules/clientes/dossier-policy';
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticate(request, 'ADMIN'); if (auth.denied) return auth.denied;
  try { const { id } = await params; const { payments, ...policy } = policyInput.parse(await request.json());
    const data = await getDb().policy.create({ data: { ...policy, ownerEmail: await responsible(getDb(), policy.productId, policy.ownerEmail), clientId: id, startDate: new Date(policy.startDate), endDate: new Date(policy.endDate), payments: { create: payments.map(p => ({ ...p, currency: policy.currency, dueDate: new Date(p.dueDate) })) } }, select: { id: true, number: true } });
    await recordEvent(auth.actor, 'created', 'polizas', data.id, data.number);
    return NextResponse.json({ data }, { status: 201 });
  } catch(error) { return apiError(error); }
}

// A policy from the catalog inherits the product's responsible unless one was chosen.
async function responsible(db: { product: { findUnique(args: object): Promise<{ ownerEmail: string | null } | null> } }, productId?: string, ownerEmail?: string) {
  if (ownerEmail || !productId) return ownerEmail;
  return (await db.product.findUnique({ where: { id: productId }, select: { ownerEmail: true } }))?.ownerEmail ?? undefined;
}
