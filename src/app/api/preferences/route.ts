import { NextResponse } from 'next/server';
import { authenticate, apiError } from '@/lib/api';
import { preferencesPatch } from '@/modules/preferences';
import { savePreferences } from '@/modules/preferences-server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Saves the signed-in user's own UI preferences (views, guided tours). Any role; never another account's.
export async function PATCH(request: Request) {
  const auth = await authenticate(request); if (auth.denied) return auth.denied;
  if (!auth.actor.email) return NextResponse.json({ error: 'SESSION_REQUIRED' }, { status: 403 });
  try {
    const patch = preferencesPatch.parse(await request.json());
    return NextResponse.json({ data: await savePreferences(auth.actor.email, patch) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}
