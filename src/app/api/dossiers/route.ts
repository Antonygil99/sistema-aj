import { NextResponse } from 'next/server';
import { authenticate, apiError } from '@/lib/api';
import { recordEvent } from '@/modules/events';
import { getDb } from '@/lib/db';
import { dossierInput } from '@/modules/clientes/dossier-policy';
import { ResourceError } from '@/modules/resources/rules';
export async function POST(request: Request) {
  const auth = await authenticate(request, 'ADMIN'); if (auth.denied) return auth.denied;
  try {
    const input = dossierInput.parse(await request.json());
    const data = await getDb().$transaction(async tx => {
      const prospect = input.prospectId ? await tx.prospect.findUnique({ where: { id: input.prospectId }, select: { id: true, name: true, ownerEmail: true, convertedClientId: true } }) : null;
      if (input.prospectId && !prospect) throw new ResourceError('RECORD_NOT_FOUND', 404);
      if (prospect?.convertedClientId) throw new ResourceError('ALREADY_CONVERTED', 409);
      const client = await tx.client.create({ data: input.client });
      if (prospect) {
        // Guarded update: two simultaneous conversions of the same prospect cannot both succeed.
        const converted = await tx.prospect.updateMany({ where: { id: prospect.id, convertedClientId: null }, data: { status: 'CLIENTE', convertedClientId: client.id } });
        if (!converted.count) throw new ResourceError('ALREADY_CONVERTED', 409);
      }
      await tx.documentFolder.createMany({ data: ['Identificación','Pólizas','Pagos','Siniestros'].map(name => ({ name, clientId: client.id })) });
      let policyId:string|null=null;
      if (input.policy) { const { payments, ...policy } = input.policy; const savedPolicy=await tx.policy.create({ data: { ...policy, ownerEmail: await responsible(tx, policy.productId, policy.ownerEmail) ?? prospect?.ownerEmail ?? undefined, clientId: client.id, startDate: new Date(policy.startDate), endDate: new Date(policy.endDate), payments: { create: payments.map(p => ({ ...p, currency: policy.currency, dueDate: new Date(p.dueDate) })) } } }); policyId=savedPolicy.id; }
      return { id: client.id, name: client.name, prospect,policyId };
    });
    await recordEvent(auth.actor, 'created', 'expedientes', data.id, data.name);
    if (data.prospect) await recordEvent(auth.actor, 'updated', 'prospectos', data.prospect.id, `${data.prospect.name} → cliente`);
    return NextResponse.json({ data: { id: data.id,policyId:data.policyId } }, { status: 201 });
  } catch (error) { return apiError(error); }
}

// A policy from the catalog inherits the product's responsible unless one was chosen.
async function responsible(db: { product: { findUnique(args: object): Promise<{ ownerEmail: string | null } | null> } }, productId?: string, ownerEmail?: string) {
  if (ownerEmail || !productId) return ownerEmail;
  return (await db.product.findUnique({ where: { id: productId }, select: { ownerEmail: true } }))?.ownerEmail ?? undefined;
}
