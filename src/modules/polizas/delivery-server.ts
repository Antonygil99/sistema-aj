import 'server-only';
import { getDb } from '@/lib/db';
import { ResourceError } from '../resources/rules';
import { deliveryInput } from './delivery-schema';
import { checklist, deliveryStage, followUps, followUpSchedule, isComplete, isFollowUpKind, nextFollowUp, type DeliveryCard } from './delivery';

const policySelect = {
  id: true, number: true, product: true, insurer: true, updatedAt: true, ownerEmail: true, deliveredAt: true, referralPotential: true,
  ...Object.fromEntries(checklist.map(item => [item.field, true])),
  client: { select: { id: true, name: true } },
  catalogProduct: { select: { id: true, name: true, imageType: true, updatedAt: true } },
  activities: { where: { archivedAt: null, kind: { in: followUps.map(item => item.kind) } }, select: { id: true, kind: true, status: true, dueDate: true } },
} as const;
type PolicyRow = Record<string, unknown> & {
  id: string; number: string; product: string; insurer: string; updatedAt: Date; ownerEmail: string | null; deliveredAt: Date | null; referralPotential: boolean;
  client: { id: string; name: string }; catalogProduct: { id: string; name: string; imageType: string | null; updatedAt: Date } | null;
  activities: { id: string; kind: string | null; status: string; dueDate: Date | null }[];
};
function toCard(row: PolicyRow): DeliveryCard {
  const checks = Object.fromEntries(checklist.map(item => [item.field, Boolean(row[item.field])])) as DeliveryCard['checks'];
  const state = { deliveredAt: row.deliveredAt, referralPotential: row.referralPotential, ...checks };
  const items = row.activities.filter(activity => isFollowUpKind(activity.kind)).map(activity => ({ id: activity.id, kind: activity.kind as DeliveryCard['followUps'][number]['kind'], status: activity.status, dueDate: activity.dueDate?.toISOString() ?? null }));
  const product = row.catalogProduct;
  return {
    id: row.id, number: row.number, product: row.product, insurer: row.insurer, updatedAt: row.updatedAt.toISOString(), ownerEmail: row.ownerEmail,
    client: row.client, catalogProduct: product ? { id: product.id, name: product.name, image: product.imageType ? `/api/products/${encodeURIComponent(product.id)}/image?v=${encodeURIComponent(product.updatedAt.toISOString())}` : null } : null,
    deliveredAt: row.deliveredAt?.toISOString() ?? null, referralPotential: row.referralPotential, checks, followUps: items,
    stage: deliveryStage(state, items), completed: isComplete(state), next: nextFollowUp(items),
  };
}
// Active, non-archived policies, optionally only those of one responsible.
export async function deliveryBoard(ownerEmail?: string | null) {
  // Every active policy belongs on the board (stage counts come from these rows); the cap only guards against runaway data.
  const rows = await getDb().policy.findMany({ where: { archivedAt: null, status: 'ACTIVE', ...(ownerEmail ? { ownerEmail } : {}) }, orderBy: [{ startDate: 'desc' }, { id: 'desc' }], take: 2000, select: policySelect });
  return (rows as unknown as PolicyRow[]).map(toCard);
}
export async function deliveryCard(id: string) {
  const row = await getDb().policy.findUnique({ where: { id }, select: policySelect });
  return row ? toCard(row as unknown as PolicyRow) : null;
}
// Saves the checklist with optimistic concurrency and keeps the 7/30/90-day follow-ups in sync with the delivery date.
export async function updateDelivery(id: string, input: unknown) {
  const value = deliveryInput.parse(input);
  const deliveredAt = value.deliveredAt ? new Date(`${value.deliveredAt}T00:00:00.000Z`) : null;
  await getDb().$transaction(async tx => {
    const policy = await tx.policy.findUnique({ where: { id }, select: { number: true, ownerEmail: true, clientId: true } });
    if (!policy) throw new ResourceError('RECORD_NOT_FOUND', 404);
    const result = await tx.policy.updateMany({ where: { id, updatedAt: new Date(value.expectedUpdatedAt) }, data: { deliveredAt, referralPotential: value.referralPotential, ...value.checks } });
    if (!result.count) throw new ResourceError('RECORD_CHANGED', 409);
    const existing = await tx.activity.findMany({ where: { policyId: id, archivedAt: null, kind: { in: followUps.map(item => item.kind) } }, select: { id: true, kind: true, status: true } });
    if (!deliveredAt) {
      // Undoing the delivery retires pending follow-ups; completed ones stay as history.
      await tx.activity.updateMany({ where: { id: { in: existing.filter(item => item.status !== 'DONE').map(item => item.id) } }, data: { archivedAt: new Date() } });
      return;
    }
    for (const step of followUpSchedule(deliveredAt)) {
      const current = existing.find(item => item.kind === step.kind);
      const wanted = value.followUps[step.kind];
      if (!current) {
        await tx.activity.create({ data: { title: `${step.label} · ${policy.number}`, description: 'Seguimiento de uso de la póliza (entrega activa).', kind: step.kind, dueDate: step.dueDate, policyId: id, ownerEmail: policy.ownerEmail, status: wanted ? 'DONE' : 'PENDING' } });
        continue;
      }
      await tx.activity.update({ where: { id: current.id }, data: { ...(current.status !== 'DONE' ? { dueDate: step.dueDate } : {}), ...(wanted === undefined ? {} : { status: wanted ? 'DONE' : 'PENDING' }) } });
    }
  });
  return deliveryCard(id);
}
