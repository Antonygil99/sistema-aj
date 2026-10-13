import 'server-only';
import { getDb } from '@/lib/db';
import { followUps } from '../polizas/delivery';
import { prospectStages } from '../prospectos/pipeline';
import { delta, monthRange, ratio } from './period';
// Dashboard numbers from real records (Ruta AJ, pilar 7: medición). Optionally scoped to one responsible.
export async function dashboardMetrics(ownerEmail: string | null, now = new Date()) {
  const db = getDb();
  const period = monthRange(now);
  const month = { gte: period.start, lt: period.end }, previous = { gte: period.prevStart, lt: period.start };
  const prospectOwner = ownerEmail ? { ownerEmail } : {};
  const policyOwner = ownerEmail ? { ownerEmail } : {};
  const viaPolicy = ownerEmail ? { policy: { ownerEmail } } : {};
  const activeProspect = { archivedAt: null, status: { in: prospectStages.map(stage => stage.id) } };
  const activePolicy = { archivedAt: null, status: 'ACTIVE' as const, ...policyOwner };
  const checks = { deliveryReceived: true, deliveryUnderstood: true, deliveryKnowsContact: true, deliveryKnowsWhenToNotify: true, deliveryKnowsFirstStep: true };
  const overdue = { archivedAt: null, status: { not: 'PAID' as const }, dueDate: { lt: period.today }, ...viaPolicy };
  const [
    funnel, converted, lost, newProspects, newProspectsPrev,
    policies, premium, issued, issuedPrev,
    renewals30, delivered, completed, followUpsLate,
    overdueCount, overdueAmount, claimsOpen, claimsClosed,
    referrals, referralsPrev, referralsTotal, quotesMonth, quotesAccepted, quotesDecided,
  ] = await Promise.all([
    db.prospect.groupBy({ by: ['status'], where: { ...activeProspect, ...prospectOwner }, _count: { _all: true } }),
    db.prospect.count({ where: { archivedAt: null, status: 'CLIENTE', convertedClient: { createdAt: month }, ...prospectOwner } }),
    db.prospect.count({ where: { archivedAt: null, status: 'PERDIDO', updatedAt: month, ...prospectOwner } }),
    db.prospect.count({ where: { archivedAt: null, createdAt: month, ...prospectOwner } }),
    db.prospect.count({ where: { archivedAt: null, createdAt: previous, ...prospectOwner } }),
    db.policy.count({ where: activePolicy }),
    db.policy.groupBy({ by: ['currency'], where: activePolicy, _sum: { premium: true } }),
    db.policy.count({ where: { archivedAt: null, createdAt: month, ...policyOwner } }),
    db.policy.count({ where: { archivedAt: null, createdAt: previous, ...policyOwner } }),
    db.renewal.count({ where: { archivedAt: null, status: { in: ['PENDING', 'CONTACTED'] }, dueDate: { gte: period.today, lte: period.in30 }, ...viaPolicy } }),
    db.policy.count({ where: { ...activePolicy, deliveredAt: { not: null } } }),
    db.policy.count({ where: { ...activePolicy, ...checks } }),
    db.activity.count({ where: { archivedAt: null, status: 'PENDING', kind: { in: followUps.map(item => item.kind) }, dueDate: { lt: period.today }, ...(ownerEmail ? { ownerEmail } : {}) } }),
    db.payment.count({ where: overdue }),
    db.payment.groupBy({ by: ['currency'], where: overdue, _sum: { amount: true } }),
    db.claim.count({ where: { archivedAt: null, status: { in: ['OPEN', 'IN_REVIEW'] }, ...viaPolicy } }),
    db.claim.count({ where: { archivedAt: null, status: 'CLOSED', updatedAt: month, ...viaPolicy } }),
    db.prospect.count({ where: { archivedAt: null, referredByClientId: { not: null }, createdAt: month, ...prospectOwner } }),
    db.prospect.count({ where: { archivedAt: null, referredByClientId: { not: null }, createdAt: previous, ...prospectOwner } }),
    db.prospect.count({ where: { archivedAt: null, referredByClientId: { not: null }, ...prospectOwner } }),
    db.quote.count({ where: { archivedAt: null, createdAt: month, ...(ownerEmail ? { prospect: { ownerEmail } } : {}) } }),
    db.quote.count({ where: { archivedAt: null, status: 'ACCEPTED', ...(ownerEmail ? { prospect: { ownerEmail } } : {}) } }),
    db.quote.count({ where: { archivedAt: null, status: { in: ['ACCEPTED', 'REJECTED'] }, ...(ownerEmail ? { prospect: { ownerEmail } } : {}) } }),
  ]);
  const byStage = new Map(funnel.map(row => [row.status, row._count._all]));
  const sum = (rows: { currency: string; _sum: Record<string, unknown> }[], field: string) => Object.fromEntries(rows.map(row => [row.currency, Number(row._sum[field] ?? 0)]));
  const activeProspects = prospectStages.reduce((total, stage) => total + (byStage.get(stage.id) ?? 0), 0);
  return {
    period: { label: period.label, previousLabel: period.previousLabel },
    prospects: { active: activeProspects, newThisMonth: newProspects, delta: delta(newProspects, newProspectsPrev, period.previousLabel) },
    funnel: [...prospectStages.map(stage => ({ id: stage.id, label: stage.label, count: byStage.get(stage.id) ?? 0 })), { id: 'CLIENTE', label: 'Clientes este mes', count: converted }],
    lostThisMonth: lost,
    policies: { active: policies, premium: sum(premium, 'premium'), issued, delta: delta(issued, issuedPrev, period.previousLabel) },
    renewals30,
    delivery: { active: policies, delivered, completed, completion: ratio(completed, policies), followUpsLate },
    collections: { overdue: overdueCount, amount: sum(overdueAmount, 'amount') },
    claims: { open: claimsOpen, closedThisMonth: claimsClosed },
    referrals: { thisMonth: referrals, total: referralsTotal, delta: delta(referrals, referralsPrev, period.previousLabel) },
    quotes: { thisMonth: quotesMonth, acceptance: ratio(quotesAccepted, quotesDecided), decided: quotesDecided },
  };
}
export type DashboardMetrics = Awaited<ReturnType<typeof dashboardMetrics>>;
