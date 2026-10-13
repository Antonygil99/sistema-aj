import { requireUser } from '@/lib/session';
import { hasRole } from '@/lib/access-policy';
import * as prospects from '@/modules/prospectos/service';
import * as clients from '@/modules/clientes/service';
import { ContactManager } from './contact-manager';
export async function ContactsPage({ slug }: { slug: 'prospectos' | 'clientes' }) {
  const user = await requireUser();
  const { data, total } = await (slug === 'prospectos' ? prospects : clients).list(20, 0);
  return <ContactManager key={slug} slug={slug} initial={data.map(row => ({ ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() }))} initialTotal={total} canEdit={hasRole(user.role, 'ADMIN')}/>;
}
