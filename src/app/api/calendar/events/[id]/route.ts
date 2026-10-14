import { z } from 'zod';
import { apiError } from '@/lib/api';
import { recordEvent } from '@/modules/events';
import { CalendarError } from '@/modules/calendar/schema';
import { calendarNoStore, calendarRepo, calendarService, calendarUser, refreshMeeting } from '@/modules/calendar/server';
export const runtime = 'nodejs';
type Context = { params: Promise<{ id: string }> };
const idSchema = z.string().regex(/^[a-f0-9]{64}$/);
export async function POST(request: Request, context: Context) {
  const auth = await calendarUser(request); if (auth.denied) return auth.denied;
  try {
    const id = idSchema.parse((await context.params).id);
    const { action } = z.object({ action: z.enum(['retry', 'refresh']) }).strict().parse(await request.json());
    const entry = await calendarRepo.find(auth.actor.id, id);
    if (!entry) throw new CalendarError('CALENDAR_EVENT_NOT_FOUND', 404);
    if (action === 'refresh') return Response.json({ data: await refreshMeeting(auth.actor.id, id, request.headers) }, { headers: calendarNoStore });
    const result = await (await calendarService(auth.actor, request.headers)).publish(auth.actor.id, entry);
    if (result.changed) await recordEvent(auth.actor, 'created', 'agenda', id, result.entry.title);
    return Response.json({ data: result.entry }, { headers: calendarNoStore });
  } catch (error) { return apiError(error); }
}
export async function DELETE(request: Request, context: Context) {
  const auth = await calendarUser(request); if (auth.denied) return auth.denied;
  try {
    const id = idSchema.parse((await context.params).id);
    const result = await (await calendarService(auth.actor, request.headers)).cancel(auth.actor.id, id);
    if (result.changed) await recordEvent(auth.actor, 'deleted', 'agenda', id, result.entry.title);
    return Response.json({ data: result.entry }, { headers: calendarNoStore });
  } catch (error) { return apiError(error); }
}
