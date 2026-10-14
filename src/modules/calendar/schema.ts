import { z } from 'zod';
export const calendarScope = 'https://www.googleapis.com/auth/calendar.events.owned';
export const calendarTimeZone = 'America/Mexico_City';
export class CalendarError extends Error {
  constructor(public code: string, public status = 400) { super(code); }
}
export function hasCalendarScope(scope: string | null) {
  const scopes = (scope ?? '').split(/[ ,]+/);
  return [calendarScope, 'https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/calendar'].some(value => scopes.includes(value));
}
export const meetingInput = z.object({
  requestId: z.uuid(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).default(''),
  location: z.string().trim().max(300).default(''),
  startAt: z.iso.datetime({ offset: true }), endAt: z.iso.datetime({ offset: true }),
  attendees: z.array(z.email().transform(email => email.toLowerCase())).max(20).default([]).transform(emails => [...new Set(emails)]),
  reminderMinutes: z.number().int().min(0).max(40320).nullable().default(30),
  reminderMethod: z.enum(['popup', 'email']).default('popup'),
  useDefaultReminders: z.boolean().default(false),
  googleMeet: z.boolean().default(false), notifyGuests: z.boolean().default(false),
  activityId: z.string().min(1).max(100).optional(),
}).strict().refine(input => new Date(input.startAt) < new Date(input.endAt), { message: 'El final debe ser posterior al inicio.', path: ['endAt'] })
  .refine(input => new Date(input.endAt).getTime() - new Date(input.startAt).getTime() <= 7 * 86400000, { message: 'La reunión no puede durar más de siete días.', path: ['endAt'] });
export type MeetingInput = z.infer<typeof meetingInput>;
export type CalendarEntry = Omit<MeetingInput, 'requestId'> & { id: string; status: string; googleUrl: string | null; meetUrl: string | null };
export type CalendarOverview = { connected: boolean; email: string; entries: CalendarEntry[]; activities: { id: string; title: string; dueDate: string | null }[] };
export { localCalendarInput, calendarInputToIso } from './types';
