import { after } from 'next/server';
import { apiError } from '@/lib/api';
import { syncMeetingReminders } from '@/modules/email/server';
import { recordEvent } from '@/modules/events';
import { meetingInput } from '@/modules/calendar/schema';
import { calendarNoStore, calendarService, calendarUser, checkMeetingActivity } from '@/modules/calendar/server';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  const auth = await calendarUser(request); if (auth.denied) return auth.denied;
  try {
    const input = meetingInput.parse(await request.json());
    await checkMeetingActivity(auth.actor, input);
    const result = await (await calendarService(auth.actor, request.headers)).create(auth.actor.id, input);
    if (result.changed) await recordEvent(auth.actor, 'created', 'agenda', result.entry.id, result.entry.title);
    after(() => syncMeetingReminders(result.entry.id));
    return Response.json({ data: result.entry }, { status: 201, headers: calendarNoStore });
  } catch (error) { return apiError(error); }
}
