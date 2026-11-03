import { apiError } from '@/lib/api';
import { calendarUser, calendarNoStore } from '@/modules/calendar/server';
import { syncCalendarRenewals } from '@/modules/calendar/renewals-server';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request: Request) {
  const auth = await calendarUser(request); if (auth.denied) return auth.denied;
  try { return Response.json(await syncCalendarRenewals(auth.actor.id, request.headers), { headers: calendarNoStore }); }
  catch (error) { return apiError(error); }
}
