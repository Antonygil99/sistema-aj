import { authorizedCleanup } from '@/modules/log-retention';
import { syncUpcomingReminders } from '@/modules/email/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const headers = { 'Cache-Control': 'private, no-store' };
// Daily (vercel.json): schedules agenda reminders that entered Resend's 30-day window. Vercel sends CRON_SECRET;
// the internal token can run it by hand. Idempotent: reminders already scheduled are kept.
export async function GET(request: Request) {
  const authorization = request.headers.get('authorization');
  if (!process.env.CRON_SECRET && !process.env.AJ_API_TOKEN) return Response.json({ error: 'CRON_NOT_CONFIGURED' }, { status: 503, headers });
  if (!authorizedCleanup(authorization, process.env.CRON_SECRET) && !authorizedCleanup(authorization, process.env.AJ_API_TOKEN)) return Response.json({ error: 'UNAUTHORIZED' }, { status: 401, headers });
  try { return Response.json({ ok: true, meetings: await syncUpcomingReminders() }, { headers }); }
  catch {
    console.error('EMAIL_CRON_FAILED');
    return Response.json({ error: 'SERVICE_UNAVAILABLE' }, { status: 503, headers });
  }
}
