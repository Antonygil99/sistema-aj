import type {NoticeSchedule} from '../preferences';
// Client notices (Avisos): which renewals, receipts and open claims need a person to reach the client today, and
// when a notice no longer applies. Pure (Mexico City calendar days, fixed UTC-6) and tested in tests/email.test.ts.
export const RENEWAL_MILESTONES = [30, 20, 10] as const;
export const PAYMENT_MILESTONES = [20, 10, 0] as const;
export const PAYMENT_GRACE_DAYS = 3;
export const CLAIM_EVERY_DAYS = 7;
export type NoticeKind = 'RENOVACION' | 'PAGO' | 'SINIESTRO';
const DAY = 86400000;
// The Mexico City calendar day of an instant; dates stored at UTC midnight keep their own day.
export const mexicoDay = (date: Date) => new Date(date.getTime() - 6 * 3600000).toISOString().slice(0, 10);
export const storedDay = (date: Date) => date.toISOString().slice(0, 10);
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);
// The notice due today: the closest milestone not yet passed (5 days left → the 10-day notice). Nothing before the
// first milestone; after the date only within the grace days (a receipt due yesterday still gets its "today" notice).
export function milestoneFor(daysLeft: number, milestones: readonly number[], grace = 0): number | null {
  const ascending = [...milestones].sort((a, b) => a - b);
  if (daysLeft < -grace || daysLeft > ascending.at(-1)!) return null;
  return ascending.find(milestone => daysLeft <= milestone) ?? null;
}
export type NoticeCandidate = { kind: NoticeKind; milestone: number; dedupeKey: string; recordId: string; clientId: string; policyId: string; paymentId: string | null; claimId: string | null; ownerEmail: string | null; dueDate: Date };
type PolicyRow = { id: string; clientId: string; endDate: Date; ownerEmail: string | null; renewed: boolean };
type PaymentRow = { id: string; policyId: string; clientId: string; dueDate: Date; ownerEmail: string | null };
type ClaimRow = { id: string; policyId: string; clientId: string; createdAt: Date; ownerEmail: string | null };
// Rows come already filtered to what is still open (active policies, unpaid receipts, open claims, not archived).
export function noticeCandidates({ today, policies, payments, claims,timingForOwner }: { today: string; policies: PolicyRow[]; payments: PaymentRow[]; claims: ClaimRow[];timingForOwner?:(email:string|null)=>NoticeSchedule }): NoticeCandidate[] {
  const list: NoticeCandidate[] = [];
  for (const policy of policies) {
    if (policy.renewed) continue;
    const milestone = milestoneFor(daysBetween(today, storedDay(policy.endDate)), timingForOwner?.(policy.ownerEmail).renewal??RENEWAL_MILESTONES);
    if (milestone !== null) list.push({ kind: 'RENOVACION', milestone, dedupeKey: `RENOVACION:${policy.id}:${milestone}`, recordId: policy.id, clientId: policy.clientId, policyId: policy.id, paymentId: null, claimId: null, ownerEmail: policy.ownerEmail, dueDate: policy.endDate });
  }
  for (const payment of payments) {
    const milestone = milestoneFor(daysBetween(today, storedDay(payment.dueDate)), timingForOwner?.(payment.ownerEmail).payment??PAYMENT_MILESTONES, PAYMENT_GRACE_DAYS);
    if (milestone !== null) list.push({ kind: 'PAGO', milestone, dedupeKey: `PAGO:${payment.id}:${milestone}`, recordId: payment.id, clientId: payment.clientId, policyId: payment.policyId, paymentId: payment.id, claimId: null, ownerEmail: payment.ownerEmail, dueDate: payment.dueDate });
  }
  for (const claim of claims) {
    // One follow-up per full week open: week 1 after 7 days, week 2 after 14…
    const interval=timingForOwner?.(claim.ownerEmail).claimEveryDays??CLAIM_EVERY_DAYS;
    const week = Math.floor(daysBetween(mexicoDay(claim.createdAt), today) / interval);
    if (week >= 1) list.push({ kind: 'SINIESTRO', milestone: week, dedupeKey: interval===7?`SINIESTRO:${claim.id}:${week}`:`SINIESTRO:${claim.id}:interval:${interval}:${week}`, recordId: claim.id, clientId: claim.clientId, policyId: claim.policyId, paymentId: null, claimId: claim.id, ownerEmail: claim.ownerEmail, dueDate: claim.createdAt });
  }
  return list;
}
// Pending notices to retire: their record no longer qualifies, or a newer milestone of the same record replaced them.
export function staleNotices<T extends { id: string; dedupeKey: string; kind: string }>(pending: T[], candidates: NoticeCandidate[]) {
  const current = new Set(candidates.map(candidate => candidate.dedupeKey));
  return pending.filter(notice => !current.has(notice.dedupeKey));
}
export const noticeKindLabels: Record<NoticeKind, string> = { RENOVACION: 'Renovación', PAGO: 'Pago', SINIESTRO: 'Siniestro' };
export function noticeTiming(kind: string, milestone: number, daysLeft: number,claimInterval=7) {
  if (kind === 'SINIESTRO') return claimInterval===7?(milestone===1?'Abierto hace 1 semana':`Abierto hace ${milestone} semanas`):`Abierto hace ${Math.max(0,-daysLeft)} días`;
  if (daysLeft === 0) return 'Vence hoy';
  if (daysLeft < 0) return daysLeft === -1 ? 'Venció ayer' : `Venció hace ${-daysLeft} días`;
  return daysLeft === 1 ? 'Vence mañana' : `Vence en ${daysLeft} días`;
}
export const noticeChannels = { EMAIL: 'Correo', TELEFONO: 'Llamada', WHATSAPP: 'WhatsApp', PRESENCIAL: 'En persona', OTRO: 'Otro medio' } as const;
export type NoticeChannel = keyof typeof noticeChannels;
// "15 de noviembre de 2026" for a stored calendar day, and amounts with their currency.
export const formatDay = (day: string) => new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`));
export function formatMoney(amount: string, currency: string) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return `${amount} ${currency}`;
  try { return `${new Intl.NumberFormat('es-MX', { style: 'currency', currency, currencyDisplay: 'narrowSymbol' }).format(value)} ${currency}`; }
  catch { return `${value.toFixed(2)} ${currency}`; }
}
// What Avisos shows for one notice (plain JSON, safe for the browser).
export type NoticeView = {
  id: string; kind: NoticeKind; milestone: number; status: string; timing: string; daysLeft: number; dueDay: string;
  client: { id: string; name: string; reachable: boolean; phone: string | null };
  policy: { id: string; number: string; product: string; insurer: string } | null;
  payment: { id: string; amount: string } | null; claim: { id: string; reference: string } | null;
  ownerEmail: string | null; needsReview: boolean; channel: string | null; note: string | null; resolvedByName: string | null; resolvedAt: string | null;
};
