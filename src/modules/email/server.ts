import 'server-only';
import { createHash } from 'node:crypto';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getDb } from '@/lib/db';
import type { Actor } from '@/lib/api';
import { getR2, storageStatus } from '@/integrations/r2/server';
import { createResend, EmailError, sender, type ResendConfig } from '@/integrations/resend/client';
import { getResend, resendConfig } from '@/integrations/resend/server';
import { isManagedKey } from '@/modules/documentos/file-policy';
import { recordEvent } from '@/modules/events';
import { readPreferences, type NotificationSettings } from '@/modules/preferences';
import { agendaReminders, allowedRecipients, checkRecipients, MAX_ATTACHMENT_BYTES, nextStatus, reminderPlan, teamRecipients, type EmailStatus } from './rules';
import { agendaReminder, BRAND, claimNotice, clientEmail, prospectNotice, type Rendered } from './templates';
import type { ComposeInput, ContactInput } from './schema';
import { draftFor, type TemplateKind } from './template-text';
import { markNoticeSent, noticeDraftValues, savedTemplate } from './notices-server';
export const appUrl = () => (process.env.BETTER_AUTH_URL || 'https://crm.segurosaleyjoel.com').replace(/\/$/, '');
const privacyUrl = () => process.env.AJ_PRIVACY_URL?.trim() || null;
const failure = (error: unknown) => error instanceof EmailError ? error.code : 'EMAIL_UNAVAILABLE';
const isDuplicate = (error: unknown) => (error as { code?: string })?.code === 'P2002';
import {deliverableWhere} from '@/modules/documentos/delivery';

export type EmailHistoryItem = { id: string; kind: string; subject: string; to: string[]; status: EmailStatus; sentByName: string; attachments: string[]; createdAt: string; sentAt: string | null };
export async function emailHistory(clientId: string, take = 20): Promise<EmailHistoryItem[]> {
  const rows = await getDb().emailMessage.findMany({ where: { clientId }, orderBy: { createdAt: 'desc' }, take, select: { id: true, kind: true, subject: true, to: true, status: true, sentByName: true, attachments: true, createdAt: true, sentAt: true } });
  return rows.map(row => ({ ...row, attachments: Array.isArray(row.attachments) ? row.attachments.flatMap(item => typeof item === 'object' && item && 'name' in item && typeof item.name === 'string' ? [item.name] : []) : [], createdAt: row.createdAt.toISOString(), sentAt: row.sentAt?.toISOString() ?? null }));
}
// Everything the composer needs for one client: who can receive, what can be attached, whether a welcome went out
// and the suggested text (the team's template filled with the client's, and the notice's, data).
export async function emailOptions(clientId: string, { kind, noticeId, actor }: { kind: TemplateKind; noticeId?: string | null; actor: Actor }) {
  const db = getDb();
  const client = await db.client.findUnique({ where: { id: clientId }, select: { id: true, name: true, email: true, contacts: { orderBy: { name: 'asc' }, select: { name: true, email: true, role: true } } } });
  if (!client) throw new EmailError('CLIENT_NOT_FOUND', 404);
  const [documents, welcome] = await Promise.all([
    db.document.findMany({ where: deliverableWhere(clientId), orderBy: { createdAt: 'desc' }, take: 100, select: { id: true, name: true, createdAt: true, policy: { select: { number: true } } } }),
    db.emailMessage.findFirst({ where: { clientId, kind: 'BIENVENIDA', status: { in: ['SENT', 'DELIVERED'] } }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
  ]);
  const notice = noticeId ? await noticeDraftValues(noticeId, client.id) : null;
  const draftKind = notice?.kind ?? kind;
  const draft = draftFor(draftKind, await savedTemplate(draftKind), { cliente: client.name, asesor: actor.name, ...notice?.values });
  return {
    client: { id: client.id, name: client.name, email: client.email },
    kind: draftKind, draft,
    recipients: allowedRecipients(client, client.contacts),
    documents: documents.map(doc => ({ id: doc.id, name: doc.name, detail: doc.policy ? `Póliza ${doc.policy.number}` : doc.createdAt.toISOString().slice(0, 10) })),
    welcomeSentAt: welcome?.createdAt.toISOString() ?? null,
    configured: Boolean(resendConfig()),
  };
}
async function attachmentsFor(documents: { name: string; storageKey: string }[]) {
  if (!documents.length) return [];
  if (!storageStatus().configured) throw new EmailError('STORAGE_NOT_CONFIGURED', 503);
  const r2 = getR2();
  const files: { filename: string; content: string }[] = [];
  let total = 0;
  for (const doc of documents) {
    let bytes: Uint8Array;
    try {
      const object = await r2.client.send(new GetObjectCommand({ Bucket: r2.bucket, Key: doc.storageKey }), { abortSignal: AbortSignal.timeout(20000) });
      if (!object.Body) throw new Error('EMPTY');
      bytes = await object.Body.transformToByteArray();
    } catch { throw new EmailError('EMAIL_DOCUMENT_UNAVAILABLE', 502); }
    total += bytes.length;
    if (total > MAX_ATTACHMENT_BYTES) throw new EmailError('EMAIL_ATTACHMENTS_TOO_LARGE', 413);
    files.push({ filename: doc.name, content: Buffer.from(bytes).toString('base64') });
  }
  return files;
}
// A person reviewed and clicked Send: the email goes out under their name and replies reach their own inbox.
export async function sendClientEmail(actor: Actor, input: ComposeInput) {
  if(!actor.id)throw new EmailError('FORBIDDEN',403);
  if(input.documentIds.length&&(!input.deliveryConfirmation?.verified||!input.deliveryConfirmation.reference.trim()))throw new EmailError('EMAIL_IDENTITY_REQUIRED',422);
  const db = getDb();
  const dedupeKey = `compose:${input.requestId}`;
  const previous = await db.emailMessage.findUnique({ where: { dedupeKey } });
  if (previous?.status === 'SENDING') throw new EmailError('EMAIL_IN_PROGRESS', 409);
  if (previous && previous.status !== 'FAILED') return previous;
  // Keep a failed attempt in the history and let the same request try again.
  if (previous) await db.emailMessage.update({ where: { id: previous.id }, data: { dedupeKey: `${dedupeKey}:fallido:${previous.id}` } });
  const client = await db.client.findUnique({ where: { id: input.clientId }, select: { id: true, name: true, email: true, contacts: { select: { name: true, email: true, role: true } } } });
  if (!client) throw new EmailError('CLIENT_NOT_FOUND', 404);
  const { to, rejected } = checkRecipients(input.to, allowedRecipients(client, client.contacts));
  if (rejected.length || !to.length) throw new EmailError('EMAIL_RECIPIENT_NOT_ALLOWED', 422);
  const found = input.documentIds.length ? await db.document.findMany({ where: { id: { in: input.documentIds }, ...deliverableWhere(client.id) }, select: { id: true, name: true, storageKey: true } }) : [];
  const documents = input.documentIds.map(id => found.find(doc => doc.id === id)).filter(doc => doc !== undefined);
  if (documents.length !== input.documentIds.length || documents.some(doc => !isManagedKey(doc.storageKey))) throw new EmailError('EMAIL_DOCUMENT_NOT_ALLOWED', 422);
  // From Avisos: the notice must still be waiting for this client.
  if (input.noticeId) await noticeDraftValues(input.noticeId, client.id);
  const { config, client: resend } = getResend();
  const files = await attachmentsFor(documents);
  const rendered = clientEmail({ subject: input.subject, message: input.message, senderName: actor.name, attachments: documents.map(doc => doc.name), privacyUrl: privacyUrl() });
  const row = await db.emailMessage.create({ data: { kind: input.kind, dedupeKey, to, subject: rendered.subject, replyTo: actor.email, attachments: documents.map(doc => ({ documentId: doc.id, name: doc.name })), clientId: client.id, sentByName: actor.name, sentByEmail: actor.email } });
  try {
    const resendId = await resend.send({ from: sender(config.from, `${actor.name} · ${BRAND}`), to, subject: rendered.subject, html: rendered.html, text: rendered.text, replyTo: actor.email, idempotencyKey: `email-${row.id}`, attachments: files, tags: [{ name: 'kind', value: input.kind }] });
    const saved = await db.emailMessage.update({ where: { id: row.id }, data: { status: 'SENT', resendId, sentAt: new Date() } });
    if (input.noticeId) await markNoticeSent(actor, input.noticeId, client.id, row.id);
    await recordEvent(actor, 'emailed', 'clientes', client.id, client.name, { kind: input.kind, subject: rendered.subject, recipients: to.length, attachments: documents.length, ...(documents.length?{deliveryConfirmation:input.deliveryConfirmation,documentIds:documents.map(doc=>doc.id)}:{}) });
    return saved;
  } catch (error) {
    await db.emailMessage.update({ where: { id: row.id }, data: { status: 'FAILED', error: failure(error) } }).catch(() => undefined);
    throw error;
  }
}

// Client contacts (people besides the client who may receive emails about it).
async function contactClient(clientId: string) {
  const client = await getDb().client.findUnique({ where: { id: clientId }, select: { id: true, name: true } });
  if (!client) throw new EmailError('CLIENT_NOT_FOUND', 404);
  return client;
}
export type ContactRow = { id: string; name: string; email: string | null; phone: string | null; role: string };
const contactSelect = { id: true, name: true, email: true, phone: true, role: true } as const;
export async function listContacts(clientId: string): Promise<ContactRow[]> {
  return getDb().clientContact.findMany({ where: { clientId }, orderBy: { name: 'asc' }, select: contactSelect });
}
export async function saveContact(actor: Actor, clientId: string, input: ContactInput, contactId?: string) {
  const client = await contactClient(clientId);
  const db = getDb();
  const data = { name: input.name, email: input.email, phone: input.phone, role: input.role };
  let contact: ContactRow;
  if (contactId) {
    const result = await db.clientContact.updateMany({ where: { id: contactId, clientId }, data });
    if (!result.count) throw new EmailError('CONTACT_NOT_FOUND', 404);
    contact = await db.clientContact.findUniqueOrThrow({ where: { id: contactId }, select: contactSelect });
  } else contact = await db.clientContact.create({ data: { ...data, clientId }, select: contactSelect });
  await recordEvent(actor, 'updated', 'clientes', client.id, client.name, { contact: contactId ? 'updated' : 'added' });
  return contact;
}
export async function deleteContact(actor: Actor, clientId: string, contactId: string) {
  const client = await contactClient(clientId);
  const result = await getDb().clientContact.deleteMany({ where: { id: contactId, clientId } });
  if (!result.count) throw new EmailError('CONTACT_NOT_FOUND', 404);
  await recordEvent(actor, 'updated', 'clientes', client.id, client.name, { contact: 'removed' });
}

// Automatic emails to teammates: one per recipient, deduplicated so a retry never repeats them (false = already sent).
export async function preferencesOf(emails: string[]) {
  const rows = emails.length ? await getDb().userPreference.findMany({ where: { email: { in: emails } }, select: { email: true, data: true } }) : [];
  const byEmail = new Map(rows.map(row => [row.email.toLowerCase(), readPreferences(row.data).notifications]));
  return (email: string): NotificationSettings => byEmail.get(email) ?? readPreferences(null).notifications;
}
export async function operators() {
  return getDb().accessGrant.findMany({ where: { enabled: true, role: { in: ['ADMIN', 'SUPERADMIN'] } }, select: { email: true, role: true, enabled: true } });
}
export async function sendTeamNotice(config: ResendConfig, notice: { kind: string; dedupeKey: string; to: string; rendered: Rendered; recordModule?: string; recordId?: string }) {
  const db = getDb();
  let row;
  try { row = await db.emailMessage.create({ data: { kind: notice.kind, dedupeKey: notice.dedupeKey, to: [notice.to], subject: notice.rendered.subject, recordModule: notice.recordModule, recordId: notice.recordId, sentByName: 'Sistema AJ' } }); }
  catch (error) { if (isDuplicate(error)) return false; throw error; }
  try {
    const resendId = await createResend(config).send({ from: sender(config.from, 'Sistema AJ'), to: [notice.to], subject: notice.rendered.subject, html: notice.rendered.html, text: notice.rendered.text, idempotencyKey: `email-${row.id}`, tags: [{ name: 'kind', value: notice.kind }] });
    await db.emailMessage.update({ where: { id: row.id }, data: { status: 'SENT', resendId, sentAt: new Date() } });
  } catch (error) { await db.emailMessage.update({ where: { id: row.id }, data: { status: 'FAILED', error: failure(error) } }).catch(() => undefined); }
  return true;
}
// Runs after the response (next/server `after`), so a slow or failing email never delays or breaks the save.
export async function notifyNewProspect(prospectId: string, actor: Actor) {
  try {
    const config = resendConfig(); if (!config) return;
    const prospect = await getDb().prospect.findUnique({ where: { id: prospectId }, select: { id: true, name: true, phone: true, email: true, source: true, ownerEmail: true } });
    if (!prospect) return;
    const grants = await operators();
    const settings = await preferencesOf(grants.map(grant => grant.email.toLowerCase()));
    const rendered = prospectNotice({ name: prospect.name, phone: prospect.phone, email: prospect.email, source: prospect.source, url: `${appUrl()}/crm/prospectos?open=${encodeURIComponent(prospect.id)}` });
    for (const to of teamRecipients({ owner: prospect.ownerEmail, grants, actorEmail: actor.email, wants: email => settings(email).emailProspects })) {
      await sendTeamNotice(config, { kind: 'PROSPECTO_NUEVO', dedupeKey: `prospecto:${prospect.id}:${to}`, to, rendered, recordModule: 'prospectos', recordId: prospect.id });
    }
  } catch { console.error('EMAIL_NOTICE_FAILED'); }
}
export async function notifyNewClaim(claimId: string, actor: Actor) {
  try {
    const config = resendConfig(); if (!config) return;
    const claim = await getDb().claim.findUnique({ where: { id: claimId }, select: { id: true, reference: true, occurredAt: true, policy: { select: { number: true, ownerEmail: true, client: { select: { id: true, name: true } } } } } });
    if (!claim) return;
    const grants = await operators();
    const settings = await preferencesOf(grants.map(grant => grant.email.toLowerCase()));
    const rendered = claimNotice({ reference: claim.reference, policyNumber: claim.policy.number, clientName: claim.policy.client.name, occurredAt: claim.occurredAt.toISOString(), url: `${appUrl()}/crm/siniestros?open=${encodeURIComponent(claim.id)}` });
    for (const to of teamRecipients({ owner: claim.policy.ownerEmail, grants, actorEmail: actor.email, wants: email => settings(email).emailClaims })) {
      await sendTeamNotice(config, { kind: 'SINIESTRO_NUEVO', dedupeKey: `siniestro:${claim.id}:${to}`, to, rendered, recordModule: 'siniestros', recordId: claim.id });
    }
  } catch { console.error('EMAIL_NOTICE_FAILED'); }
}

// Agenda reminders for the meeting's owner, scheduled in Resend so they leave on time without a minute-level job.
const agendaKey = (meetingId: string, kind: string, version: string, at: Date) => `agenda:${meetingId}:${kind}:${version}:${at.getTime()}`;
export async function syncMeetingReminders(meetingId: string) {
  try {
    const config = resendConfig(); if (!config) return;
    const db = getDb();
    const meeting = await db.calendarMeeting.findUnique({ where: { id: meetingId }, include: { user: { select: { email: true } } } });
    if (!meeting) return;
    const now = new Date();
    const email = meeting.user.email.toLowerCase();
    const [grant, preference, existing] = await Promise.all([
      db.accessGrant.findUnique({ where: { email }, select: { enabled: true } }),
      db.userPreference.findUnique({ where: { email }, select: { data: true } }),
      // Reminders whose moment passed are left alone: they were sent (or are being sent) and cannot be cancelled.
      db.emailMessage.findMany({ where: { meetingId, status: 'SCHEDULED', scheduledAt: { gt: new Date(now.getTime() + 60000) } }, select: { id: true, kind: true, scheduledAt: true, resendId: true, dedupeKey: true } }),
    ]);
    const version = createHash('sha256').update(JSON.stringify([meeting.title, meeting.location, meeting.startAt.toISOString(), meeting.endAt.toISOString(), meeting.meetUrl, meeting.googleUrl])).digest('hex').slice(0, 12);
    const active = meeting.status === 'SYNCED' && grant?.enabled === true && readPreferences(preference?.data).notifications.emailAgenda;
    const plan = reminderPlan(existing.map(row => ({ ...row, version: row.dedupeKey.split(':')[3] ?? '' })), active ? agendaReminders(meeting.startAt, now) : [], version);
    const resend = createResend(config);
    for (const row of plan.cancel) {
      try { if (row.resendId) await resend.cancel(row.resendId); }
      catch (error) { if (!(error instanceof EmailError && error.code === 'EMAIL_NOT_FOUND')) { console.error('EMAIL_REMINDER_CANCEL_FAILED'); continue; } }
      await db.emailMessage.update({ where: { id: row.id }, data: { status: 'CANCELLED', dedupeKey: `${row.dedupeKey}:cancelado:${row.id}` } });
    }
    for (const want of plan.create) {
      const rendered = agendaReminder({ kind: want.kind, title: meeting.title, startAt: meeting.startAt.toISOString(), endAt: meeting.endAt.toISOString(), location: meeting.location, meetUrl: meeting.meetUrl, googleUrl: meeting.googleUrl, appUrl: appUrl() });
      let row;
      try { row = await db.emailMessage.create({ data: { kind: want.kind, dedupeKey: agendaKey(meeting.id, want.kind, version, want.at), to: [email], subject: rendered.subject, meetingId: meeting.id, sentByName: 'Sistema AJ', scheduledAt: want.at } }); }
      catch (error) { if (isDuplicate(error)) continue; throw error; }
      try {
        const resendId = await resend.send({ from: sender(config.from, 'Sistema AJ'), to: [email], subject: rendered.subject, html: rendered.html, text: rendered.text, scheduledAt: want.at.toISOString(), idempotencyKey: `email-${row.id}`, tags: [{ name: 'kind', value: want.kind }] });
        await db.emailMessage.update({ where: { id: row.id }, data: { status: 'SCHEDULED', resendId } });
      } catch (error) { await db.emailMessage.update({ where: { id: row.id }, data: { status: 'FAILED', error: failure(error) } }).catch(() => undefined); }
    }
  } catch { console.error('EMAIL_REMINDER_SYNC_FAILED'); }
}
// Daily job: schedules reminders that just entered Resend's 30-day window and cleans up after cancelled meetings.
export async function syncUpcomingReminders(now = new Date()) {
  const meetings = await getDb().calendarMeeting.findMany({
    where: { OR: [{ status: 'SYNCED', startAt: { gt: now, lte: new Date(now.getTime() + 31 * 86400000) } }, { status: { not: 'SYNCED' }, emails: { some: { status: 'SCHEDULED', scheduledAt: { gt: now } } } }] },
    select: { id: true }, orderBy: { startAt: 'asc' }, take: 200,
  });
  for (const meeting of meetings) await syncMeetingReminders(meeting.id);
  return meetings.length;
}

// Delivery events from Resend's webhook.
export async function applyEmailEvent(type: string, resendId: string) {
  const db = getDb();
  const row = await db.emailMessage.findUnique({ where: { resendId }, select: { id: true, status: true, sentAt: true } });
  if (!row) return false;
  const status = nextStatus(row.status, type);
  if (status) await db.emailMessage.updateMany({ where: { id: row.id, status: row.status }, data: { status, ...((status === 'SENT' || status === 'DELIVERED') && !row.sentAt ? { sentAt: new Date() } : {}) } });
  return true;
}
