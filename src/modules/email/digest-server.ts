import 'server-only';
import { getDb } from '@/lib/db';
import { resendConfig } from '@/integrations/resend/server';
import { daysBetween, formatDay, formatMoney, mexicoDay, noticeKindLabels, storedDay, type NoticeKind } from './notices';
import { normalizeAddress } from './rules';
import { dailyDigest, formatWhen, type DigestItem, type DigestSection } from './templates';
import { appUrl, operators, preferencesOf, sendTeamNotice } from './server';
const midnight = (day: string) => new Date(`${day}T00:00:00.000Z`);
const shift = (day: string, days: number) => new Date(Date.parse(`${day}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const LIMIT = 8;
const days = (count: number) => count === 1 ? '1 día' : `${count} días`;
// Each teammate's morning summary (Mexico City day): their meetings and what needs attention in their portfolio.
// Records without a responsible appear for every administrator. Nothing to report means no email. One per day.
export async function sendDailyDigests(now = new Date()) {
  const config = resendConfig(); if (!config) return 0;
  const db = getDb();
  const today = mexicoDay(now);
  const base = appUrl();
  const grants = await operators();
  const settings = await preferencesOf(grants.map(grant => normalizeAddress(grant.email)));
  const recipients = grants.map(grant => normalizeAddress(grant.email)).filter(email => settings(email).emailDigest);
  if (!recipients.length) return 0;
  const startOfDay = new Date(`${today}T00:00:00-06:00`);
  const [users, meetings, notices, policies, payments, followUps, claims] = await Promise.all([
    db.authUser.findMany({ where: { email: { in: recipients } }, select: { id: true, email: true, name: true } }),
    db.calendarMeeting.findMany({ where: { status: 'SYNCED', startAt: { gte: startOfDay, lt: new Date(startOfDay.getTime() + 86400000) } }, orderBy: { startAt: 'asc' }, select: { userId: true, title: true, startAt: true, meetUrl: true } }),
    db.clientNotice.findMany({ where: { status: 'PENDING' }, select: { kind: true, ownerEmail: true } }),
    db.policy.findMany({ where: { status: 'ACTIVE', archivedAt: null, endDate: { gte: midnight(today), lte: midnight(shift(today, 30)) }, renewals: { none: { status: 'RENEWED', archivedAt: null } } }, orderBy: { endDate: 'asc' }, select: { id: true, number: true, endDate: true, ownerEmail: true, client: { select: { name: true } } } }),
    db.payment.findMany({ where: { status: { not: 'PAID' }, archivedAt: null, dueDate: { gte: midnight(shift(today, -30)), lte: midnight(shift(today, 7)) }, policy: { archivedAt: null, status: { not: 'CANCELLED' } } }, orderBy: { dueDate: 'asc' }, select: { id: true, amount: true, currency: true, dueDate: true, policy: { select: { number: true, ownerEmail: true, client: { select: { name: true } } } } } }),
    db.activity.findMany({ where: { kind: { not: null }, status: 'PENDING', archivedAt: null, dueDate: { lte: midnight(today) } }, orderBy: { dueDate: 'asc' }, select: { title: true, dueDate: true, ownerEmail: true, policyId: true } }),
    db.claim.findMany({ where: { status: { not: 'CLOSED' }, archivedAt: null }, orderBy: { createdAt: 'asc' }, select: { id: true, reference: true, createdAt: true, policy: { select: { ownerEmail: true, client: { select: { name: true } } } } } }),
  ]);
  // Mine = assigned to me, or assigned to nobody (visible to every administrator).
  const mine = (owner: string | null, email: string) => !owner || normalizeAddress(owner) === email;
  const section = (title: string, items: DigestItem[], link?: DigestSection['link']): DigestSection => ({ title, items: items.slice(0, LIMIT), more: Math.max(0, items.length - LIMIT), link });
  let sent = 0;
  for (const email of recipients) {
    const user = users.find(item => item.email.toLowerCase() === email);
    const myNotices = notices.filter(notice => mine(notice.ownerEmail, email));
    const counts = (['RENOVACION', 'PAGO', 'SINIESTRO'] as NoticeKind[]).map(kind => [kind, myNotices.filter(notice => notice.kind === kind).length] as const).filter(([, count]) => count);
    const sections: DigestSection[] = [
      section('Tu agenda de hoy', meetings.filter(meeting => meeting.userId === user?.id).map(meeting => ({ text: `${formatWhen(meeting.startAt, false)} · ${meeting.title}`, url: meeting.meetUrl ?? `${base}/agenda` }))),
      section('Avisos a clientes por revisar', counts.map(([kind, count]) => ({ text: `${noticeKindLabels[kind]}: ${count}`, url: `${base}/avisos` })), { label: 'Abrir Avisos a clientes', url: `${base}/avisos` }),
      section('Seguimientos de entrega para hoy o atrasados', followUps.filter(item => mine(item.ownerEmail, email)).map(item => ({ text: item.title, detail: item.dueDate ? `Programado para ${formatDay(storedDay(item.dueDate))}` : undefined, url: item.policyId ? `${base}/crm/entregas?open=${encodeURIComponent(item.policyId)}` : `${base}/crm/entregas` }))),
      section('Pólizas que vencen en los próximos 30 días', policies.filter(policy => mine(policy.ownerEmail, email)).map(policy => ({ text: `${policy.client.name} · ${policy.number}`, detail: `Vence el ${formatDay(storedDay(policy.endDate))} (en ${days(daysBetween(today, storedDay(policy.endDate)))})`, url: `${base}/crm/polizas?open=${encodeURIComponent(policy.id)}` }))),
      section('Recibos que vencen esta semana o están vencidos', payments.filter(payment => mine(payment.policy.ownerEmail, email)).map(payment => {
        const left = daysBetween(today, storedDay(payment.dueDate));
        return { text: `${payment.policy.client.name} · ${payment.policy.number} · ${formatMoney(payment.amount.toFixed(2), payment.currency)}`, detail: left < 0 ? `Vencido hace ${days(-left)}` : left === 0 ? 'Vence hoy' : `Vence en ${days(left)}`, url: `${base}/crm/pagos?open=${encodeURIComponent(payment.id)}` };
      })),
      section('Siniestros abiertos', claims.filter(claim => mine(claim.policy.ownerEmail, email)).map(claim => ({ text: `${claim.reference} · ${claim.policy.client.name}`, detail: `Abierto hace ${days(Math.max(0, daysBetween(mexicoDay(claim.createdAt), today)))}`, url: `${base}/crm/siniestros?open=${encodeURIComponent(claim.id)}` }))),
    ];
    if (!sections.some(item => item.items.length)) continue;
    const rendered = dailyDigest({ name: user?.name ?? '', dayLabel: new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(midnight(today)), sections, appUrl: base });
    if (await sendTeamNotice(config, { kind: 'RESUMEN', dedupeKey: `resumen:${today}:${email}`, to: email, rendered })) sent++;
  }
  return sent;
}
