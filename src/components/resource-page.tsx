import { requireUser } from '@/lib/session';
import { isViewKey } from '@/modules/preferences';
import { getPreferences } from '@/modules/preferences-server';
import { hasRole } from '@/lib/access-policy';
import { listResource } from '@/modules/resources/server';
import { redact } from '@/modules/resources/rules';
import { resources, type ResourceSlug, type Row } from '@/modules/resources/config';
import { ResourceManager } from './resource-manager';
export async function ResourcePage({ slug, query = '', openId }: { slug: ResourceSlug; query?: string; openId?: string }) {
  const user = await requireUser();
  const q = query.trim().slice(0, 100);
  // Pipeline boards show every active record at once; plain tables page by 20. The user's last view wins.
  const preferences = await getPreferences(user.email);
  const view = resources[slug].board && !(isViewKey(slug) && preferences.views[slug] === 'list') ? 'board' : 'list';
  const result = await listResource(slug, { take: view === 'board' ? 100 : 20, skip: 0, q });
  // Decimals and dates must cross into the client component as plain JSON.
  const initial = JSON.parse(JSON.stringify({ data: result.data.map(row => redact(slug, row, user.role)), total: result.total })) as { data: Row[]; total: number };
  return <ResourceManager key={`${slug}:${q}:${openId ?? ''}`} slug={slug} initial={initial} initialQuery={q} canEdit={hasRole(user.role, 'ADMIN')} canDelete={user.role === 'SUPERADMIN'} openId={openId?.slice(0, 100)} initialView={view}/>;
}
