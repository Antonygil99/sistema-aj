import { z } from 'zod';
import { CalendarError, calendarTimeZone, type MeetingInput } from './schema';
export const googleEventSchema = z.object({
  id: z.string(), status: z.string().optional(), htmlLink: z.string().optional(), hangoutLink: z.string().optional(),
  summary: z.string().optional(), description: z.string().optional(), location: z.string().optional(),
  attendees: z.array(z.object({ email: z.string().optional() })).optional(),
  reminders: z.object({ useDefault: z.boolean().optional(), overrides: z.array(z.object({ method: z.enum(['email', 'popup']), minutes: z.number().int() })).optional() }).optional(),
  start: z.object({ dateTime: z.string().optional(), date: z.string().optional() }).optional(),
  end: z.object({ dateTime: z.string().optional(), date: z.string().optional() }).optional(),
  extendedProperties: z.object({ private: z.record(z.string(), z.string()).optional() }).optional(),
  conferenceData: z.object({ createRequest: z.object({ status: z.object({ statusCode: z.string() }).optional() }).optional() }).optional(),
});
export type GoogleEvent = z.infer<typeof googleEventSchema>;
export function safeGoogleLink(value: string | undefined, meet = false) {
  try {
    const url = new URL(value ?? '');
    const valid = meet ? url.hostname === 'meet.google.com' : url.hostname === 'calendar.google.com' || (url.hostname === 'www.google.com' && url.pathname.startsWith('/calendar/'));
    return url.protocol === 'https:' && !url.username && !url.password && valid ? url.toString() : null;
  } catch { return null; }
}
export function eventBody(input: Omit<MeetingInput, 'requestId'>, googleId: string) {
  return {
    id: googleId, summary: input.title, description: input.description, location: input.location,
    start: { dateTime: input.startAt, timeZone: calendarTimeZone }, end: { dateTime: input.endAt, timeZone: calendarTimeZone },
    attendees: input.attendees.map(email => ({ email })),
    reminders: { useDefault: input.useDefaultReminders, ...(input.useDefaultReminders ? {} : { overrides: input.reminderMinutes === null ? [] : [{ method: input.reminderMethod, minutes: input.reminderMinutes }] }) },
    extendedProperties: { private: { sistemaAjId: googleId } },
    ...(input.googleMeet ? { conferenceData: { createRequest: { requestId: googleId, conferenceSolutionKey: { type: 'hangoutsMeet' } } } } : {}),
  };
}
export function calendarGoogle(token: string, transport: typeof fetch = fetch) {
  const base = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
  async function call(path: string, method = 'GET', body?: unknown) {
    let response: Response;
    try { response = await transport(base + path, { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000), cache: 'no-store' }); }
    catch { throw new CalendarError('CALENDAR_UNAVAILABLE', 503); }
    const data = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 409) throw new CalendarError('CALENDAR_DUPLICATE', 409);
      if ([404, 410].includes(response.status)) throw new CalendarError('CALENDAR_EVENT_NOT_FOUND', 404);
      if (response.status === 401) throw new CalendarError('CALENDAR_RECONNECT', 409);
      if (response.status === 429) throw new CalendarError('CALENDAR_RATE_LIMIT', 429);
      if (response.status === 403) {
        const reasons = data?.error?.errors?.map((error: { reason?: string }) => error.reason) ?? [];
        if (reasons.some((reason: string) => ['rateLimitExceeded', 'userRateLimitExceeded', 'quotaExceeded'].includes(reason))) throw new CalendarError('CALENDAR_RATE_LIMIT', 429);
        throw new CalendarError('CALENDAR_PERMISSION', 403);
      }
      if (response.status === 400) throw new CalendarError('CALENDAR_EVENT_INVALID', 422);
      throw new CalendarError('CALENDAR_UNAVAILABLE', 503);
    }
    return data;
  }
  return {
    async verify() { await call('?maxResults=1&fields=kind'); },
    async insert(input: Omit<MeetingInput, 'requestId'>, id: string): Promise<GoogleEvent> {
      try { return googleEventSchema.parse(await call(`?conferenceDataVersion=1&sendUpdates=${input.notifyGuests ? 'all' : 'none'}`, 'POST', eventBody(input, id))); }
      catch (error) {
        if (!(error instanceof CalendarError) || error.code !== 'CALENDAR_DUPLICATE') throw error;
        const event = await this.get(id);
        if (event.extendedProperties?.private?.sistemaAjId !== id || event.status === 'cancelled') throw new CalendarError('CALENDAR_EVENT_CHANGED', 409);
        return event;
      }
    },
    async get(id: string) { return googleEventSchema.parse(await call(`/${encodeURIComponent(id)}`)); },
    async cancel(id: string, notify: boolean) {
      try { await call(`/${encodeURIComponent(id)}?sendUpdates=${notify ? 'all' : 'none'}`, 'DELETE'); }
      catch (error) { if (!(error instanceof CalendarError) || error.code !== 'CALENDAR_EVENT_NOT_FOUND') throw error; }
    },
  };
}
