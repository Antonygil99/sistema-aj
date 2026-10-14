import { z } from 'zod';
import { apiError } from '@/lib/api';
import { recordEvent } from '@/modules/events';
import { calendarNoStore, calendarOverview, calendarUser } from '@/modules/calendar/server';
import { getDb } from '@/lib/db';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const auth = await calendarUser(request); if (auth.denied) return auth.denied;
  try {
    const view = z.enum(['upcoming', 'history']).parse(new URL(request.url).searchParams.get('view') ?? 'upcoming');
    return Response.json({ data: await calendarOverview(auth.actor.id, auth.actor.email, view === 'history') }, { headers: calendarNoStore });
  } catch (error) { return apiError(error); }
}
export async function DELETE(request: Request) {
  const auth = await calendarUser(request); if (auth.denied) return auth.denied;
  try {
    const result = await getDb().calendarConnection.updateMany({ where: { userId: auth.actor.id }, data: { enabled: false, connectNonce: null, connectExpiresAt: null } });
    if (result.count) await recordEvent(auth.actor, 'updated', 'agenda', auth.actor.id, 'Google Calendar desconectado');
    return Response.json({ data: { connected: false } }, { headers: calendarNoStore });
  } catch (error) { return apiError(error); }
}
