import 'server-only';
import { getDb } from '@/lib/db';
import type { Actor } from '@/lib/api';
import { EmailError } from '@/integrations/resend/client';
import { recordEvent } from '@/modules/events';
import { daysBetween, formatDay, formatMoney, mexicoDay, noticeCandidates, noticeKindLabels, noticeTiming, PAYMENT_GRACE_DAYS, staleNotices, storedDay, type NoticeKind, type NoticeView } from './notices';
export type { NoticeView } from './notices';
import { templateKinds, type Placeholder, type TemplateKind, type TemplateText } from './template-text';
import type { NoticeAction } from './schema';
const midnight = (day: string) => new Date(`${day}T00:00:00.000Z`);
const shift = (day: string, days: number) => new Date(Date.parse(`${day}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const lower = (email: string | null) => email ? email.toLowerCase() : null;

// Creates today's notices (each milestone once, even if it was dismissed) and retires those whose record no longer
// qualifies (paid receipt, renewed or cancelled policy, closed claim) or that a newer milestone replaced.
// Idempotent: runs from the daily job and every time someone opens Avisos.
export async function refreshNotices(now = new Date()) {
  const db = getDb();
  const today = mexicoDay(now);
  const openClient = { archivedAt: null };
  const [policies, payments, claims] = await Promise.all([
    db.policy.findMany({ where: { status: 'ACTIVE', archivedAt: null, client: openClient, endDate: { gte: midnight(today), lte: midnight(shift(today, 30)) } }, select: { id: true, clientId: true, endDate: true, ownerEmail: true, renewals: { where: { status: 'RENEWED', archivedAt: null }, select: { id: true }, take: 1 } } }),
    db.payment.findMany({ where: { status: { not: 'PAID' }, archivedAt: null, dueDate: { gte: midnight(shift(today, -PAYMENT_GRACE_DAYS)), lte: midnight(shift(today, 20)) }, policy: { archivedAt: null, status: { not: 'CANCELLED' }, client: openClient } }, select: { id: true, policyId: true, dueDate: true, policy: { select: { clientId: true, ownerEmail: true } } } }),
    db.claim.findMany({ where: { status: { not: 'CLOSED' }, archivedAt: null, policy: { client: openClient } }, select: { id: true, policyId: true, createdAt: true, policy: { select: { clientId: true, ownerEmail: true } } } }),
  ]);
  const candidates = noticeCandidates({
    today,
    policies: policies.map(policy => ({ id: policy.id, clientId: policy.clientId, endDate: policy.endDate, ownerEmail: lower(policy.ownerEmail), renewed: policy.renewals.length > 0 })),
    payments: payments.map(payment => ({ id: payment.id, policyId: payment.policyId, clientId: payment.policy.clientId, dueDate: payment.dueDate, ownerEmail: lower(payment.policy.ownerEmail) })),
    claims: claims.map(claim => ({ id: claim.id, policyId: claim.policyId, clientId: claim.policy.clientId, createdAt: claim.createdAt, ownerEmail: lower(claim.policy.ownerEmail) })),
  });
  if (candidates.length) await db.clientNotice.createMany({ data: candidates.map(candidate => ({ kind: candidate.kind, milestone: candidate.milestone, dedupeKey: candidate.dedupeKey, clientId: candidate.clientId, policyId: candidate.policyId, paymentId: candidate.paymentId, claimId: candidate.claimId, ownerEmail: candidate.ownerEmail, dueDate: candidate.dueDate })), skipDuplicates: true });
  const pending = await db.clientNotice.findMany({ where: { status: 'PENDING' }, select: { id: true, dedupeKey: true, kind: true, ownerEmail: true } });
  const stale = staleNotices(pending, candidates);
  if (stale.length) await db.clientNotice.updateMany({ where: { id: { in: stale.map(notice => notice.id) }, status: 'PENDING' }, data: { status: 'EXPIRED', resolvedAt: now } });
  // A pending notice follows its policy's current responsible.
  const owners = new Map(candidates.map(candidate => [candidate.dedupeKey, candidate.ownerEmail]));
  for (const notice of pending) {
    const owner = owners.get(notice.dedupeKey);
    if (owner !== undefined && owner !== notice.ownerEmail) await db.clientNotice.update({ where: { id: notice.id }, data: { ownerEmail: owner } });
  }
  return { candidates: candidates.length, expired: stale.length };
}

// Pending notices (or the ones resolved in the last 14 days), most urgent first. "Mine" includes unassigned ones.
export async function listNotices({ scope, email, resolved = false, now = new Date() }: { scope: 'mine' | 'all'; email: string | null; resolved?: boolean; now?: Date }): Promise<NoticeView[]> {
  const db = getDb();
  const today = mexicoDay(now);
  const notices = await db.clientNotice.findMany({
    where: { ...(resolved ? { status: { in: ['SENT', 'NOTIFIED', 'DISMISSED'] }, resolvedAt: { gte: new Date(now.getTime() - 14 * 86400000) } } : { status: 'PENDING' }), ...(scope === 'mine' && email ? { OR: [{ ownerEmail: email.toLowerCase() }, { ownerEmail: null }] } : {}) },
    orderBy: resolved ? { resolvedAt: 'desc' } : { dueDate: 'asc' }, take: 200,
    include: { client: { select: { id: true, name: true, email: true, phone: true, contacts: { where: { email: { not: null } }, select: { id: true }, take: 1 } } } },
  });
  const ids = (key: 'policyId' | 'paymentId' | 'claimId') => [...new Set(notices.flatMap(notice => notice[key] ? [notice[key]!] : []))];
  const [policies, payments, claims] = await Promise.all([
    db.policy.findMany({ where: { id: { in: ids('policyId') } }, select: { id: true, number: true, product: true, insurer: true, sourceData: true } }),
    db.payment.findMany({ where: { id: { in: ids('paymentId') } }, select: { id: true, amount: true, currency: true } }),
    db.claim.findMany({ where: { id: { in: ids('claimId') } }, select: { id: true, reference: true } }),
  ]);
  const views = notices.map(notice => {
    const policy = policies.find(item => item.id === notice.policyId) ?? null;
    const payment = payments.find(item => item.id === notice.paymentId) ?? null;
    const claim = claims.find(item => item.id === notice.claimId) ?? null;
    const dueDay = notice.kind === 'SINIESTRO' ? mexicoDay(notice.dueDate) : storedDay(notice.dueDate);
    const daysLeft = daysBetween(today, dueDay);
    const source = policy?.sourceData && typeof policy.sourceData === 'object' ? policy.sourceData as Record<string, unknown> : null;
    return {
      id: notice.id, kind: notice.kind as NoticeKind, milestone: notice.milestone, status: notice.status, timing: noticeTiming(notice.kind, notice.milestone, daysLeft), daysLeft, dueDay,
      client: { id: notice.client.id, name: notice.client.name, reachable: Boolean(notice.client.email?.trim()) || notice.client.contacts.length > 0, phone: notice.client.phone },
      policy: policy ? { id: policy.id, number: policy.number, product: policy.product, insurer: policy.insurer } : null,
      payment: payment ? { id: payment.id, amount: formatMoney(payment.amount.toFixed(2), payment.currency) } : null,
      claim: claim ? { id: claim.id, reference: claim.reference } : null,
      ownerEmail: notice.ownerEmail, needsReview: notice.kind === 'PAGO' && source?.paymentsNeedReview === true,
      channel: notice.channel, note: notice.note, resolvedByName: notice.resolvedByName, resolvedAt: notice.resolvedAt?.toISOString() ?? null,
    };
  });
  // Claims have no deadline; they sit after what is due within the week.
  return resolved ? views : views.sort((a, b) => (a.kind === 'SINIESTRO' ? 7 : a.daysLeft) - (b.kind === 'SINIESTRO' ? 7 : b.daysLeft));
}
async function noticeOrThrow(id: string) {
  const notice = await getDb().clientNotice.findUnique({ where: { id }, include: { client: { select: { name: true } } } });
  if (!notice) throw new EmailError('NOTICE_NOT_FOUND', 404);
  return notice;
}
export async function resolveNotice(actor: Actor, id: string, action: NoticeAction) {
  const db = getDb();
  const notice = await noticeOrThrow(id);
  const label = `${noticeKindLabels[notice.kind as NoticeKind] ?? notice.kind} · ${notice.client.name}`;
  if (action.action === 'reopen') {
    const result = await db.clientNotice.updateMany({ where: { id, status: { in: ['NOTIFIED', 'DISMISSED'] } }, data: { status: 'PENDING', channel: null, note: null, resolvedAt: null, resolvedByName: null, resolvedByEmail: null } });
    if (!result.count) throw new EmailError('NOTICE_ALREADY_RESOLVED', 409);
  } else {
    const result = await db.clientNotice.updateMany({ where: { id, status: 'PENDING' }, data: { status: action.action === 'notified' ? 'NOTIFIED' : 'DISMISSED', channel: action.action === 'notified' ? action.channel : null, note: action.note || null, resolvedAt: new Date(), resolvedByName: actor.name, resolvedByEmail: actor.email } });
    if (!result.count) throw new EmailError('NOTICE_ALREADY_RESOLVED', 409);
  }
  await recordEvent(actor, 'updated', 'avisos', id, label, { action: action.action, ...(action.action === 'notified' ? { channel: action.channel } : {}) });
}
// The record data a notice's email can use ({poliza}, {vence}, {monto}…).
export async function noticeDraftValues(noticeId: string, clientId: string): Promise<{ kind: TemplateKind; values: Partial<Record<Placeholder, string>> }> {
  const db = getDb();
  const notice = await noticeOrThrow(noticeId);
  if (notice.clientId !== clientId) throw new EmailError('NOTICE_NOT_FOUND', 404);
  if (notice.status !== 'PENDING') throw new EmailError('NOTICE_ALREADY_RESOLVED', 409);
  const [policy, payment, claim] = await Promise.all([
    notice.policyId ? db.policy.findUnique({ where: { id: notice.policyId }, select: { number: true, product: true, insurer: true, endDate: true } }) : null,
    notice.paymentId ? db.payment.findUnique({ where: { id: notice.paymentId }, select: { amount: true, currency: true, dueDate: true } }) : null,
    notice.claimId ? db.claim.findUnique({ where: { id: notice.claimId }, select: { reference: true } }) : null,
  ]);
  const due = payment ? storedDay(payment.dueDate) : policy ? storedDay(policy.endDate) : null;
  return {
    kind: notice.kind as TemplateKind,
    values: {
      ...(policy ? { poliza: policy.number, producto: policy.product, aseguradora: policy.insurer } : {}),
      ...(due ? { vence: formatDay(due), dias: String(Math.max(0, daysBetween(mexicoDay(new Date()), due))) } : {}),
      ...(payment ? { monto: formatMoney(payment.amount.toFixed(2), payment.currency) } : {}),
      ...(claim ? { referencia: claim.reference } : {}),
    },
  };
}
export async function markNoticeSent(actor: Actor, noticeId: string, clientId: string, emailId: string) {
  await getDb().clientNotice.updateMany({ where: { id: noticeId, clientId, status: 'PENDING' }, data: { status: 'SENT', channel: 'EMAIL', emailId, resolvedAt: new Date(), resolvedByName: actor.name, resolvedByEmail: actor.email } });
}

// Team-wide texts. A kind without a saved row uses the suggested default.
export async function savedTemplate(kind: TemplateKind): Promise<TemplateText | null> {
  const row = await getDb().emailTemplate.findUnique({ where: { kind }, select: { subject: true, body: true } });
  return row ?? null;
}
export async function listTemplates() {
  const rows = await getDb().emailTemplate.findMany();
  return templateKinds.map(kind => {
    const row = rows.find(item => item.kind === kind);
    return { kind, subject: row?.subject ?? null, body: row?.body ?? null, updatedByName: row?.updatedByName ?? null, updatedAt: row?.updatedAt.toISOString() ?? null };
  });
}
export async function saveTemplate(actor: Actor, kind: TemplateKind, input: TemplateText) {
  await getDb().emailTemplate.upsert({ where: { kind }, create: { kind, ...input, updatedByName: actor.name, updatedByEmail: actor.email }, update: { ...input, updatedByName: actor.name, updatedByEmail: actor.email } });
  await recordEvent(actor, 'updated', 'plantillas', kind, kind);
}
export async function resetTemplate(actor: Actor, kind: TemplateKind) {
  await getDb().emailTemplate.deleteMany({ where: { kind } });
  await recordEvent(actor, 'restored', 'plantillas', kind, kind);
}
