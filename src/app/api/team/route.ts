import { NextResponse } from 'next/server';
import { authenticate, apiError } from '@/lib/api';
import { getDb } from '@/lib/db';
import { normalizeEmail } from '@/lib/access-policy';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Teammates who can be responsible for products, policies and follow-ups (enabled accounts only).
export async function GET(request: Request) {
  const auth = await authenticate(request); if (auth.denied) return auth.denied;
  try {
    const db = getDb();
    const grants = await db.accessGrant.findMany({ where: { enabled: true }, select: { email: true, role: true }, orderBy: { createdAt: 'asc' } });
    const profiles = await db.authUser.findMany({ where: { email: { in: grants.map(grant => grant.email) } }, select: { email: true, name: true } });
    const data = grants.map(grant => ({ email: grant.email, role: grant.role, name: profiles.find(profile => normalizeEmail(profile.email) === grant.email)?.name ?? null }));
    return NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}
