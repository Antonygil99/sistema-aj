// Browser-safe types and calendar helpers. Request validation stays on the server.
export type { MeetingInput, CalendarEntry, CalendarOverview } from './schema';
export function localCalendarInput(iso: string) { return new Date(new Date(iso).getTime() - 6 * 3600000).toISOString().slice(0, 16); }
export function calendarInputToIso(value: string) { return new Date(`${value}:00-06:00`).toISOString(); }
