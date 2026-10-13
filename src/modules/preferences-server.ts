import 'server-only';
import { cache } from 'react';
import type { Prisma } from '@/generated/prisma/client';
import { getDb } from '@/lib/db';
import { normalizeEmail } from '@/lib/access-policy';
import { defaultPreferences, mergePreferences, readPreferences, type Preferences, type PreferencesPatch } from './preferences';
// One read per request; a database hiccup falls back to defaults instead of breaking the page.
export const getPreferences = cache(async (email: string): Promise<Preferences> => {
  try {
    const row = await getDb().userPreference.findUnique({ where: { email: normalizeEmail(email) }, select: { data: true } });
    return readPreferences(row?.data);
  } catch { return defaultPreferences; }
});
export async function savePreferences(email: string, patch: PreferencesPatch): Promise<Preferences> {
  const key = normalizeEmail(email);
  return getDb().$transaction(async tx => {
    const row = await tx.userPreference.findUnique({ where: { email: key }, select: { data: true } });
    const next = mergePreferences(readPreferences(row?.data), patch);
    const data = next as unknown as Prisma.InputJsonObject;
    await tx.userPreference.upsert({ where: { email: key }, create: { email: key, data }, update: { data } });
    return next;
  });
}
