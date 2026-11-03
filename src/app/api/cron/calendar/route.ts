import { authorizedCleanup } from '@/modules/log-retention';
import { getDb } from '@/lib/db';
import { syncCalendarRenewals } from '@/modules/calendar/renewals-server';
export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const authorization = request.headers.get('authorization');
  if (!authorizedCleanup(authorization, process.env.CRON_SECRET) && !authorizedCleanup(authorization, process.env.AJ_API_TOKEN)) return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  const deadline = Date.now() + 40000;
  const connections = await getDb().calendarConnection.findMany({ where: { enabled: true }, orderBy: { renewalLastRunAt: { sort: 'asc', nulls: 'first' } }, select: { userId: true } });
  let processed = 0, failed = 0;
  for (const connection of connections) {
    if (Date.now() >= deadline) break;
    try {
      let more = true;
      while (more && Date.now() < deadline) {
        const result = await syncCalendarRenewals(connection.userId, undefined, deadline);
        more = result.more && !result.running;
      }
      processed++;
    }
    catch { failed++; console.error('CALENDAR_RENEWAL_SYNC_FAILED'); }
  }
  return Response.json({ processed, failed, remaining: connections.length - processed - failed }, { status: failed ? 503 : 200, headers: { 'Cache-Control': 'private, no-store' } });
}
