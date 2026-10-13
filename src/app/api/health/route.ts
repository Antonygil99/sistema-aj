import { getDb } from '@/lib/db';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const noStore = { 'Cache-Control': 'no-store' };
// Liveness: the application answers (no database, used by the smoke scripts). `?db=1` also times three trivial
// queries from the function's own region: the first includes opening a connection when the instance is cold, the
// rest are plain round trips. It returns timings only, never data, and can serve as the keep-warm ping.
export async function GET(request: Request) {
  const base = { service: 'sistema-aj', status: 'ok', scope: 'application', region: process.env.VERCEL_REGION ?? null };
  if (new URL(request.url).searchParams.get('db') !== '1') return Response.json(base, { headers: noStore });
  try {
    const db = getDb();
    const timings: number[] = [];
    for (let i = 0; i < 3; i++) {
      const started = performance.now();
      await db.$queryRaw`SELECT 1`;
      timings.push(Math.round(performance.now() - started));
    }
    return Response.json({ ...base, scope: 'database', database: { ok: true, firstMs: timings[0], roundTripMs: Math.min(...timings.slice(1)) } }, { headers: noStore });
  } catch {
    return Response.json({ ...base, status: 'degraded', scope: 'database', database: { ok: false } }, { status: 503, headers: noStore });
  }
}
