import { requireUser } from '@/lib/session';
import { hasRole } from '@/lib/access-policy';
import { listResource } from '@/modules/resources/server';
import type { ResourceSlug, Row } from '@/modules/resources/config';
import { ResourceManager } from './resource-manager';
export async function ResourcePage({ slug, query = '' }: { slug: ResourceSlug; query?: string }) {
  const user = await requireUser();
  const q = query.trim().slice(0, 100);
  const result = await listResource(slug, { take: 20, skip: 0, q });
  // Decimals and dates must cross into the client component as plain JSON.
  const initial = JSON.parse(JSON.stringify({ data: result.data, total: result.total })) as { data: Row[]; total: number };
  return <ResourceManager key={`${slug}:${q}`} slug={slug} initial={initial} initialQuery={q} canEdit={hasRole(user.role, 'ADMIN')} canDelete={user.role === 'SUPERADMIN'}/>;
}
