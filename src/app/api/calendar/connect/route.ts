import { getAuth } from '@/lib/auth';
import { apiError } from '@/lib/api';
import { calendarScope } from '@/modules/calendar/schema';
import { calendarUser, calendarNoStore } from '@/modules/calendar/server';
import { randomUUID, createHash } from 'node:crypto';
import { getDb } from '@/lib/db';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  const auth = await calendarUser(request); if (auth.denied) return auth.denied;
  try {
    const attempt = randomUUID();
    const pending = { connectNonce: createHash('sha256').update(attempt).digest('hex'), connectExpiresAt: new Date(Date.now() + 10 * 60000) };
    await getDb().calendarConnection.upsert({ where: { userId: auth.actor.id }, create: { userId: auth.actor.id, enabled: false, ...pending }, update: pending });
    const result = await getAuth()!.api.linkSocialAccount({ headers: request.headers, body: {
      provider: 'google', scopes: [calendarScope], loginHint: auth.actor.email, disableRedirect: true,
      callbackURL: `${process.env.BETTER_AUTH_URL}/api/calendar/connected?attempt=${attempt}`, errorCallbackURL: `${process.env.BETTER_AUTH_URL}/agenda?calendar=denied`,
      additionalParams: { access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true' },
    } });
    return Response.json({ url: result.url }, { headers: calendarNoStore });
  } catch (error) { return apiError(error); }
}
