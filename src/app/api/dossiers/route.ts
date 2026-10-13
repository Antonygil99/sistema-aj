import { NextResponse } from 'next/server';
import { authenticate, apiError } from '@/lib/api';
import { recordEvent } from '@/modules/events';
import { getDb } from '@/lib/db';
import { dossierInput } from '@/modules/clientes/dossier-policy';
export async function POST(request: Request) {
  const auth = await authenticate(request, 'ADMIN'); if (auth.denied) return auth.denied;
  try {
    const input = dossierInput.parse(await request.json());
    const data = await getDb().$transaction(async tx => {
      const client = await tx.client.create({ data: input.client });
      await tx.documentFolder.createMany({ data: ['Identificación','Pólizas','Pagos','Siniestros'].map(name => ({ name, clientId: client.id })) });
      if (input.policy) { const { payments, ...policy } = input.policy; await tx.policy.create({ data: { ...policy, clientId: client.id, startDate: new Date(policy.startDate), endDate: new Date(policy.endDate), payments: { create: payments.map(p => ({ ...p, currency: policy.currency, dueDate: new Date(p.dueDate) })) } } }); }
      return { id: client.id, name: client.name };
    });
    await recordEvent(auth.actor, 'created', 'expedientes', data.id, data.name);
    return NextResponse.json({ data: { id: data.id } }, { status: 201 });
  } catch (error) { return apiError(error); }
}
