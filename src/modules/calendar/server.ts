import 'server-only';
import { getDb } from '@/lib/db';
import { getAuth } from '@/lib/auth';
import { authenticate, type Actor } from '@/lib/api';
import { z } from 'zod';
import type { CalendarMeeting } from '@/generated/prisma/client';
import { CalendarError, hasCalendarScope, type CalendarEntry, type CalendarOverview, type MeetingInput } from './schema';
import { calendarGoogle, safeGoogleLink } from './google';
import { meetingService, type MeetingRepository } from './service';
export const calendarNoStore = { 'Cache-Control': 'private, no-store' };
export async function calendarUser(request: Request) {
  const auth = await authenticate(request);
  if (auth.denied) return auth;
  if (!auth.actor.id || !auth.actor.email) return { denied: Response.json({ error: 'SESSION_REQUIRED' }, { status: 403 }) };
  return { actor: { ...auth.actor, id: auth.actor.id, email: auth.actor.email } };
}
export async function googleAccount(userId: string) {
  return getDb().authAccount.findFirst({ where: { userId, providerId: 'google' }, select: { id: true, scope: true, refreshToken: true, refreshTokenExpiresAt: true } });
}
export function entryFromRow(row: CalendarMeeting): CalendarEntry {
  return { id: row.id, title: row.title, description: row.description, location: row.location, startAt: row.startAt.toISOString(), endAt: row.endAt.toISOString(),
    attendees: z.array(z.string()).parse(row.attendees), reminderMinutes: row.reminderMinutes, reminderMethod: row.reminderMethod === 'email' ? 'email' : 'popup', useDefaultReminders: row.useDefaultReminders, googleMeet: row.googleMeet, notifyGuests: row.notifyGuests,
    activityId: row.activityId ?? undefined, status: row.status, googleUrl: row.googleUrl, meetUrl: row.meetUrl };
}
export async function calendarOverview(userId: string, email: string, history = false): Promise<CalendarOverview> {
  const db = getDb();
  const [connection, entries, activities] = await Promise.all([
    db.calendarConnection.findUnique({ where: { userId } }),
    db.calendarMeeting.findMany({ where: { userId, ...(history ? {} : { OR: [{ endAt: { gte: new Date() }, status: { not: 'CANCELLED' } }, { status: { in: ['PENDING', 'CANCEL_PENDING', 'FAILED'] } }] }) }, orderBy: { startAt: history ? 'desc' : 'asc' }, take: 50 }),
    db.activity.findMany({ where: { ownerEmail: email, archivedAt: null, status: 'PENDING' }, select: { id: true, title: true, dueDate: true }, orderBy: { dueDate: 'asc' }, take: 50 }),
  ]);
  return { connected: Boolean(connection?.enabled), email, entries: entries.map(entryFromRow), activities: activities.map(activity => ({ ...activity, dueDate: activity.dueDate?.toISOString() ?? null })) };
}
export async function calendarCredentials(userId: string, headers: Headers, requireConnected = true) {
  if (requireConnected && !(await getDb().calendarConnection.findUnique({ where: { userId } }))?.enabled) throw new CalendarError('CALENDAR_NOT_CONNECTED', 409);
  const account = await googleAccount(userId);
  if (!account || !hasCalendarScope(account.scope) || !account.refreshToken || (account.refreshTokenExpiresAt && account.refreshTokenExpiresAt <= new Date())) throw new CalendarError('CALENDAR_RECONNECT', 409);
  const auth = getAuth();
  if (!auth) throw new CalendarError('AUTH_NOT_CONFIGURED', 503);
  try {
    const token = await auth.api.getAccessToken({ headers, body: { accountId: account.id } });
    if (!token.accessToken || (token.accessTokenExpiresAt && new Date(token.accessTokenExpiresAt) <= new Date())) throw new Error('TOKEN_EXPIRED');
    return calendarGoogle(token.accessToken);
  } catch { throw new CalendarError('CALENDAR_RECONNECT', 409); }
}
export const calendarRepo: MeetingRepository = {
  async reserve(userId, id, input) {
    const { requestId: _, startAt, endAt, ...data } = input;
    void _;
    try { return entryFromRow(await getDb().calendarMeeting.create({ data: { ...data, id, userId, googleEventId: id, startAt: new Date(startAt), endAt: new Date(endAt) } })); }
    catch (error) {
      if ((error as { code?: string }).code !== 'P2002') throw error;
      const entry = await this.find(userId, id);
      if (!entry) throw new CalendarError('CALENDAR_EVENT_CHANGED', 409);
      return entry;
    }
  },
  async find(userId, id) { const row = await getDb().calendarMeeting.findFirst({ where: { userId, id } }); return row ? entryFromRow(row) : null; },
  async confirm(userId, id, googleUrl, meetUrl) { return (await getDb().calendarMeeting.updateMany({ where: { userId, id, status: 'PENDING' }, data: { status: 'SYNCED', googleUrl, meetUrl } })).count === 1; },
  async failCreation(userId, id) { await getDb().calendarMeeting.updateMany({ where: { userId, id, status: 'PENDING' }, data: { status: 'FAILED' } }); },
  async markCancelling(userId, id) { await getDb().calendarMeeting.updateMany({ where: { userId, id, status: { in: ['SYNCED', 'FAILED'] } }, data: { status: 'CANCEL_PENDING' } }); },
  async finishCancelled(userId, id) { return (await getDb().calendarMeeting.updateMany({ where: { userId, id, status: 'CANCEL_PENDING' }, data: { status: 'CANCELLED', meetUrl: null } })).count === 1; },
};
export async function calendarService(actor: Actor & { id: string }, headers: Headers) { return meetingService(calendarRepo, await calendarCredentials(actor.id, headers)); }
export async function checkMeetingActivity(actor: Actor & { id: string; email: string }, input: MeetingInput) {
  if (!input.activityId) return;
  const activity = await getDb().activity.findFirst({ where: { id: input.activityId, ownerEmail: actor.email, archivedAt: null, status: 'PENDING' }, select: { id: true } });
  if (!activity) throw new CalendarError('CALENDAR_ACTIVITY_NOT_FOUND', 404);
}
export async function refreshMeeting(userId: string, id: string, headers: Headers) {
  const row = await getDb().calendarMeeting.findFirst({ where: { userId, id } });
  if (!row) throw new CalendarError('CALENDAR_EVENT_NOT_FOUND', 404);
  if (row.status !== 'SYNCED') throw new CalendarError('CALENDAR_EVENT_CHANGED', 409);
  const google = await calendarCredentials(userId, headers);
  try {
    const event = await google.get(row.googleEventId);
    if (event.status === 'cancelled') throw new CalendarError('CALENDAR_EVENT_NOT_FOUND', 404);
    const start = event.start?.dateTime ?? (event.start?.date ? `${event.start.date}T00:00:00-06:00` : undefined);
    const end = event.end?.dateTime ?? (event.end?.date ? `${event.end.date}T00:00:00-06:00` : undefined);
    await getDb().calendarMeeting.updateMany({ where: { userId, id, status: 'SYNCED' }, data: { title: event.summary ?? row.title, description: event.description ?? '', location: event.location ?? '',
      ...(start ? { startAt: new Date(start) } : {}), ...(end ? { endAt: new Date(end) } : {}), googleUrl: safeGoogleLink(event.htmlLink), meetUrl: safeGoogleLink(event.hangoutLink, true),
      attendees: (event.attendees ?? []).flatMap(guest => guest.email ? [guest.email] : []),
      useDefaultReminders: Boolean(event.reminders?.useDefault), reminderMinutes: event.reminders?.overrides?.[0]?.minutes ?? null, reminderMethod: event.reminders?.overrides?.[0]?.method ?? 'popup' } });
  } catch (error) {
    if (!(error instanceof CalendarError) || error.code !== 'CALENDAR_EVENT_NOT_FOUND') throw error;
    await getDb().calendarMeeting.updateMany({ where: { userId, id, status: 'SYNCED' }, data: { status: 'CANCELLED', meetUrl: null } });
  }
  return (await calendarRepo.find(userId, id))!;
}
