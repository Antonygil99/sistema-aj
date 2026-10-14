import { createHash } from 'node:crypto';
import { CalendarError, type CalendarEntry, type MeetingInput } from './schema';
import { safeGoogleLink, type calendarGoogle } from './google';
export type MeetingRepository = {
  reserve(userId: string, id: string, input: MeetingInput): Promise<CalendarEntry>;
  find(userId: string, id: string): Promise<CalendarEntry | null>;
  confirm(userId: string, id: string, googleUrl: string | null, meetUrl: string | null): Promise<boolean>;
  failCreation(userId: string, id: string): Promise<void>;
  markCancelling(userId: string, id: string): Promise<void>;
  finishCancelled(userId: string, id: string): Promise<boolean>;
};
export function meetingId(userId: string, requestId: string) { return createHash('sha256').update(`${userId}:${requestId}`).digest('hex'); }
export function sameMeeting(entry: CalendarEntry, input: MeetingInput) {
  return entry.title === input.title && entry.description === input.description && entry.location === input.location &&
    new Date(entry.startAt).getTime() === new Date(input.startAt).getTime() && new Date(entry.endAt).getTime() === new Date(input.endAt).getTime() &&
    JSON.stringify(entry.attendees) === JSON.stringify(input.attendees) && entry.reminderMinutes === input.reminderMinutes && entry.reminderMethod === input.reminderMethod &&
    entry.googleMeet === input.googleMeet && entry.notifyGuests === input.notifyGuests && entry.useDefaultReminders === input.useDefaultReminders && (entry.activityId ?? null) === (input.activityId ?? null);
}
export function meetingService(repo: MeetingRepository, google: ReturnType<typeof calendarGoogle>) {
  return {
    async create(userId: string, input: MeetingInput) {
      const id = meetingId(userId, input.requestId);
      const entry = await repo.reserve(userId, id, input);
      if (!sameMeeting(entry, input)) throw new CalendarError('CALENDAR_EVENT_CHANGED', 409);
      return this.publish(userId, entry);
    },
    async publish(userId: string, entry: CalendarEntry) {
      if (entry.status === 'SYNCED') return { entry, changed: false };
      if (entry.status !== 'PENDING') throw new CalendarError('CALENDAR_EVENT_CHANGED', 409);
      let event;
      try { event = await google.insert(entry, entry.id); }
      catch (error) {
        // A Google 400 definitively rejected the insert; keep transient failures retryable.
        if (error instanceof CalendarError && error.code === 'CALENDAR_EVENT_INVALID') await repo.failCreation(userId, entry.id);
        throw error;
      }
      const changed = await repo.confirm(userId, entry.id, safeGoogleLink(event.htmlLink), safeGoogleLink(event.hangoutLink, true));
      return { entry: (await repo.find(userId, entry.id))!, changed };
    },
    async cancel(userId: string, id: string) {
      const entry = await repo.find(userId, id);
      if (!entry) throw new CalendarError('CALENDAR_EVENT_NOT_FOUND', 404);
      if (entry.status === 'CANCELLED') return { entry, changed: false };
      if (entry.status === 'FAILED') {
        await repo.markCancelling(userId, id);
        const changed = await repo.finishCancelled(userId, id);
        return { entry: (await repo.find(userId, id))!, changed };
      }
      if (!['SYNCED', 'CANCEL_PENDING'].includes(entry.status)) throw new CalendarError('CALENDAR_EVENT_CHANGED', 409);
      await repo.markCancelling(userId, id);
      await google.cancel(id, entry.notifyGuests);
      const changed = await repo.finishCancelled(userId, id);
      return { entry: (await repo.find(userId, id))!, changed };
    },
  };
}
