import { NextResponse } from 'next/server';
import { authenticate, apiError } from '@/lib/api';
import { resources, type ResourceSlug, type Row } from '@/modules/resources/config';
import { searchResource } from '@/modules/resources/server';
import { resourceResult, searchQuery, sectionResults } from '@/modules/search';
import { searchSupplement } from '@/modules/search-server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await authenticate(request);
  if (auth.denied) return auth.denied;
  try {
    const q = searchQuery(new URL(request.url).searchParams.get('q'));
    if (q.length < 2) return NextResponse.json({ q, results: [] }, { headers: { 'Cache-Control': 'no-store' } });
    const slugs = Object.keys(resources) as ResourceSlug[];
    const [tables, extra] = await Promise.all([
      Promise.all(slugs.map(async slug => (await searchResource(slug, q,5,auth.actor)).map(row => resourceResult(slug, JSON.parse(JSON.stringify(row)) as Row)))),
      searchSupplement(q, auth.actor),
    ]);
    return NextResponse.json({ q, results: [...tables.flat(), ...extra, ...sectionResults(q, auth.actor.role)] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}
