import { calendarUser, calendarCredentials } from '@/modules/calendar/server';
import { getDb } from '@/lib/db';
import { recordEvent } from '@/modules/events';
import { z } from 'zod';
import { createHash } from 'node:crypto';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  const auth = await calendarUser(request); if (auth.denied) return auth.denied;
  let result = 'connected';
  try {
    const attempt = z.uuid().parse(new URL(request.url).searchParams.get('attempt'));
    const connectNonce = createHash('sha256').update(attempt).digest('hex');
    const where = { userId: auth.actor.id, connectNonce, connectExpiresAt: { gt: new Date() } };
    if (!await getDb().calendarConnection.findFirst({ where })) throw new Error('CONNECT_EXPIRED');
    await (await calendarCredentials(auth.actor.id, request.headers, false)).verify();
    const saved = await getDb().calendarConnection.updateMany({ where, data: { enabled: true, connectedAt: new Date(), connectNonce: null, connectExpiresAt: null } });
    if (!saved.count) throw new Error('CONNECT_EXPIRED');
    await recordEvent(auth.actor, 'updated', 'agenda', auth.actor.id, 'Google Calendar conectado');
  } catch { result = 'reconnect'; }
  return new Response(null, { status: 303, headers: { Location: new URL(`/agenda?calendar=${result}`, process.env.BETTER_AUTH_URL!).toString(), 'Cache-Control': 'private, no-store' } });
}
