// Email rules: who may receive a client email, when agenda reminders go out, how scheduled reminders follow a
// meeting, how Resend's delivery events move a message's status and which teammates get automatic notices.
// Pure and free of zod (the composer imports it); tested in tests/email.test.ts.
import type { AgendaKind } from './templates';
export const MAX_RECIPIENTS = 10;
export const MAX_ATTACHMENTS = 10;
export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
export const EMAIL_PATTERN = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/;
export const normalizeAddress = (value: string) => value.trim().toLowerCase();
export type Recipient = { email: string; name: string; label: string };
// A client email can only go to the client's own address or to one of its registered contacts: to write to someone
// new, register them first. That keeps every recipient visible in the dossier.
export function allowedRecipients(client: { name: string; email: string | null }, contacts: { name: string; email: string | null; role: string }[]): Recipient[] {
  const seen = new Set<string>();
  const list: Recipient[] = [];
  const add = (email: string | null, name: string, label: string) => {
    const address = email ? normalizeAddress(email) : '';
    if (!address || !EMAIL_PATTERN.test(address) || seen.has(address)) return;
    seen.add(address);
    list.push({ email: address, name, label });
  };
  add(client.email, client.name, 'Cliente');
  for (const contact of contacts) add(contact.email, contact.name, contact.role.trim() || 'Contacto');
  return list;
}
export function checkRecipients(requested: string[], allowed: Recipient[]) {
  const permitted = new Set(allowed.map(item => item.email));
  const to = [...new Set(requested.map(normalizeAddress))];
  return { to, rejected: to.filter(email => !permitted.has(email)) };
}

// Agenda reminders for the meeting's owner: a day before, 08:00 (Mexico City) on the day and 10 minutes before.
// Resend schedules at most 30 days ahead, so later ones are left for the daily job (/api/cron/email).
const MINUTE = 60000, HOUR = 60 * MINUTE, DAY = 24 * HOUR;
export const SCHEDULE_WINDOW = 29 * DAY;
const MEXICO_OFFSET = -6 * HOUR; // Mexico City has no daylight saving time since 2022.
export function agendaReminders(startAt: Date, now: Date): { kind: AgendaKind; at: Date }[] {
  const start = startAt.getTime();
  const localDay = new Date(start + MEXICO_OFFSET).toISOString().slice(0, 10);
  const morning = Date.parse(`${localDay}T08:00:00-06:00`);
  const candidates: { kind: AgendaKind; at: number }[] = [{ kind: 'AGENDA_1D', at: start - DAY }];
  // Before 09:00 the morning notice would land right before the meeting; the 10-minute one covers it.
  if (start - morning >= HOUR) candidates.push({ kind: 'AGENDA_DIA', at: morning });
  candidates.push({ kind: 'AGENDA_10M', at: start - 10 * MINUTE });
  return candidates.filter(item => item.at > now.getTime() + MINUTE && item.at <= now.getTime() + SCHEDULE_WINDOW).map(item => ({ kind: item.kind, at: new Date(item.at) }));
}
type Scheduled = { id: string; kind: string; scheduledAt: Date | null; version: string };
// Compares the reminders still pending with what the meeting needs now. The email text carries the meeting's time
// and details, so a reminder whose moment or content version changed is cancelled and created again; one that no
// longer applies (cancelled meeting, notice turned off) is cancelled; a missing one is created.
export function reminderPlan<T extends Scheduled>(existing: T[], desired: { kind: AgendaKind; at: Date }[], version: string) {
  const create: { kind: AgendaKind; at: Date }[] = [];
  const cancel: T[] = [];
  const pending = [...existing];
  for (const want of desired) {
    const index = pending.findIndex(row => row.kind === want.kind && row.version === version && row.scheduledAt && Math.abs(row.scheduledAt.getTime() - want.at.getTime()) <= 30000);
    if (index >= 0) pending.splice(index, 1);
    else create.push(want);
  }
  cancel.push(...pending);
  return { create, cancel };
}

// Resend webhook events → message status. Statuses only move forward; a cancelled message stays cancelled.
export type EmailStatus = 'SENDING' | 'SCHEDULED' | 'SENT' | 'DELIVERED' | 'BOUNCED' | 'COMPLAINED' | 'FAILED' | 'CANCELLED';
const eventStatus: Record<string, EmailStatus> = {
  'email.sent': 'SENT', 'email.delivered': 'DELIVERED', 'email.bounced': 'BOUNCED', 'email.complained': 'COMPLAINED',
  'email.failed': 'FAILED', 'email.suppressed': 'BOUNCED',
};
const rank: Record<EmailStatus, number> = { SENDING: 0, SCHEDULED: 1, SENT: 2, DELIVERED: 3, BOUNCED: 4, FAILED: 4, COMPLAINED: 5, CANCELLED: 6 };
export function nextStatus(current: EmailStatus, event: string): EmailStatus | null {
  const target = eventStatus[event];
  if (!target || current === 'CANCELLED' || current === target) return null;
  // A complaint can follow a delivery; anything else only advances.
  return rank[target] > rank[current] ? target : null;
}
export const statusLabels: Record<EmailStatus, string> = {
  SENDING: 'Enviando', SCHEDULED: 'Programado', SENT: 'Enviado', DELIVERED: 'Entregado', BOUNCED: 'Rebotó', COMPLAINED: 'Marcado como spam', FAILED: 'Falló', CANCELLED: 'Cancelado',
};

// Automatic notices go to the record's responsible when they operate the CRM, otherwise to every administrator,
// never to whoever created the record (they already know) and only to those who keep that notice on.
export function teamRecipients({ owner, grants, actorEmail, wants }: { owner: string | null; grants: { email: string; role: string; enabled: boolean }[]; actorEmail: string | null; wants: (email: string) => boolean }) {
  const operators = grants.filter(grant => grant.enabled && (grant.role === 'ADMIN' || grant.role === 'SUPERADMIN')).map(grant => normalizeAddress(grant.email));
  const ownerAddress = owner ? normalizeAddress(owner) : null;
  const base = ownerAddress && operators.includes(ownerAddress) ? [ownerAddress] : operators;
  const actor = actorEmail ? normalizeAddress(actorEmail) : null;
  return [...new Set(base)].filter(email => email !== actor && wants(email));
}
