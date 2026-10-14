import { authorizedCleanup } from '@/modules/log-retention';
import { syncUpcomingReminders } from '@/modules/email/server';
import { refreshNotices } from '@/modules/email/notices-server';
import { sendDailyDigests } from '@/modules/email/digest-server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const headers = { 'Cache-Control': 'private, no-store' };
// Daily at ~07:00 Mexico City (vercel.json): schedules agenda reminders that entered Resend's 30-day window, refreshes
// the client notices and sends each teammate's morning summary. Vercel sends CRON_SECRET; the internal token can run
// it by hand. Idempotent: scheduled reminders, notices and today's summaries are never repeated.
export async function GET(request: Request) {
  const authorization = request.headers.get('authorization');
  if (!process.env.CRON_SECRET && !process.env.AJ_API_TOKEN) return Response.json({ error: 'CRON_NOT_CONFIGURED' }, { status: 503, headers });
  if (!authorizedCleanup(authorization, process.env.CRON_SECRET) && !authorizedCleanup(authorization, process.env.AJ_API_TOKEN)) return Response.json({ error: 'UNAUTHORIZED' }, { status: 401, headers });
  try {
    const meetings = await syncUpcomingReminders();
    const notices = await refreshNotices();
    const digests = await sendDailyDigests();
    return Response.json({ ok: true, meetings, notices, digests }, { headers });
  }
  catch {
    console.error('EMAIL_CRON_FAILED');
    return Response.json({ error: 'SERVICE_UNAVAILABLE' }, { status: 503, headers });
  }
}
