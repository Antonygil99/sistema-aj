import { NextResponse } from 'next/server';
import { authenticate, apiError } from '@/lib/api';
import { getDb } from '@/lib/db';
import { normalizeEmail } from '@/lib/access-policy';
import { resources, type ResourceSlug, type Row } from '@/modules/resources/config';
import { searchResource } from '@/modules/resources/server';
import { documentResult, folderResult, resourceResult, searchQuery, userResult, type SearchResult } from '@/modules/search';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const contains = (q: string) => ({ contains: q, mode: 'insensitive' as const });
// One query across the CRM: every table the person can read; access grants only for the superadmin.
export async function GET(request: Request) {
  const auth = await authenticate(request); if (auth.denied) return auth.denied;
  try {
    const q = searchQuery(new URL(request.url).searchParams.get('q'));
    if (q.length < 2) return NextResponse.json({ q, results: [] }, { headers: { 'Cache-Control': 'no-store' } });
    const db = getDb();
    const slugs = Object.keys(resources) as ResourceSlug[];
    const [tables, documents, folders, users] = await Promise.all([
      Promise.all(slugs.map(async slug => (await searchResource(slug, q)).map(row => resourceResult(slug, JSON.parse(JSON.stringify(row)) as Row)))),
      db.document.findMany({ where: { archivedAt: null, name: contains(q) }, take: 6, orderBy: { createdAt: 'desc' }, select: { id: true, name: true, mimeType: true, client: { select: { name: true } }, policy: { select: { number: true } } } }),
      db.documentFolder.findMany({ where: { name: contains(q) }, take: 4, orderBy: { name: 'asc' }, select: { id: true, name: true, clientId: true, client: { select: { name: true } } } }),
      auth.actor.role === 'SUPERADMIN' ? searchUsers(q) : Promise.resolve([]),
    ]);
    const results: SearchResult[] = [...tables.flat(), ...documents.map(documentResult), ...folders.map(folderResult), ...users.map(userResult)];
    return NextResponse.json({ q, results }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}
async function searchUsers(q: string) {
  const db = getDb();
  const named = await db.authUser.findMany({ where: { name: contains(q) }, take: 5, select: { email: true } });
  const grants = await db.accessGrant.findMany({ where: { OR: [{ email: contains(q) }, { email: { in: named.map(user => normalizeEmail(user.email)) } }] }, take: 5, select: { id: true, email: true, role: true, enabled: true } });
  const profiles = await db.authUser.findMany({ where: { email: { in: grants.map(grant => grant.email) } }, select: { email: true, name: true } });
  return grants.map(grant => ({ ...grant, name: profiles.find(profile => normalizeEmail(profile.email) === grant.email)?.name ?? null }));
}
