import { getDb } from '@/lib/db';
import { authorizedCleanup, deleteExpiredLogs } from '@/modules/log-retention';
import { purgeExpiredUploads } from '@/modules/mcp/actor';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const headers = { 'Cache-Control': 'private, no-store' };
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) return Response.json({ error: 'CLEANUP_NOT_CONFIGURED' }, { status: 503, headers });
  if (!authorizedCleanup(request.headers.get('authorization'), process.env.CRON_SECRET)) return Response.json({ error: 'UNAUTHORIZED' }, { status: 401, headers });
  try {
    await purgeExpiredUploads();
    const deleted = await getDb().$transaction(tx => deleteExpiredLogs(tx));
    return Response.json({ ok: true, deleted }, { headers });
  } catch {
    console.error('LOG_RETENTION_CLEANUP_FAILED');
    return Response.json({ error: 'SERVICE_UNAVAILABLE' }, { status: 503, headers });
  }
}
