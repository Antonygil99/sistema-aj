import Link from 'next/link';
import { Add, Folder2, FolderOpen, SearchNormal1 } from 'iconsax-reactjs';
import { getDb } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { hasRole } from '@/lib/access-policy';
import { coverageState } from '@/modules/clientes/dossier-policy';
import { formatDate, formatMoney } from '@/modules/resources/config';
import { EmptyState } from './ui/empty-state';
import { LinkPending } from './ui/link-pending';
import { ClientViewSwitch } from './client-view-switch';
const PAGE = 24;
export async function DossiersPage({ query = '', page = 0 }: { query?: string; page?: number }) {
  const user = await requireUser();
  const canEdit = hasRole(user.role, 'ADMIN');
  const db = getDb();
  const q = query.trim().slice(0, 100);
  const skip = Math.max(0, Math.min(10000, page)) * PAGE;
  const where = { archivedAt: null, ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' as const } }, { email: { contains: q, mode: 'insensitive' as const } }, { phone: { contains: q } }] } : {}) };
  const [clients, total] = await Promise.all([
    db.client.findMany({ where, skip, take: PAGE, orderBy: { name: 'asc' }, include: { policies: { where: { archivedAt: null }, include: { payments: { where: { archivedAt: null, status: { not: 'PAID' } }, orderBy: { dueDate: 'asc' }, take: 1 } } } } }),
    db.client.count({ where }),
  ]);
  const newButton = canEdit ? <Link className="button" href="/crm/clientes/nuevo"><Add aria-hidden="true"/>Nuevo expediente</Link> : null;
  return <>
    <div className="resource-toolbar"><ClientViewSwitch current="dossiers"/><span className="resource-count">{total} expediente{total === 1 ? '' : 's'}</span>{newButton}</div>
    <form className="resource-filters"><label className="search-field"><SearchNormal1 aria-hidden="true"/><span className="sr-only">Buscar expediente</span><input name="q" type="search" defaultValue={q} placeholder="Nombre, correo o teléfono" maxLength={100}/></label><button className="button button-soft">Buscar</button></form>
    {clients.length ? <div className="dossier-grid">{clients.map((client, index) => {
      const next = client.policies.flatMap(policy => policy.payments.map(payment => ({ ...payment, currency: policy.currency }))).sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0];
      return <Link className={`dossier-card folder-tone-${index % 3}`} key={client.id} href={`/crm/clientes/${client.id}`}><LinkPending/>
        {/* Back panel (the link itself, with its tab), a sheet of paper and the front panel that tilts open on hover. */}
        <span className="folder-sheet" aria-hidden="true"/>
        <div className="folder-front"><span className="folder-icon" aria-hidden="true"><Folder2 size={26} className="folder-glyph-closed"/><FolderOpen size={26} className="folder-glyph-open"/></span><span className="subtle-pill">{coverageState(client.policies)}</span><h2>{client.name}</h2><p>{client.policies.length} póliza{client.policies.length === 1 ? '' : 's'} · {client.email || client.phone || 'Sin contacto registrado'}</p><div className="dossier-card-bottom">{next ? `Próximo recibo: ${formatDate(next.dueDate.toISOString())} · ${formatMoney(next.amount.toString(), next.currency)}` : 'Sin recibos pendientes'}</div></div></Link>;
    })}</div>
    : <EmptyState illustration={q ? 'busqueda' : 'clientes'} title={q ? 'Ningún expediente coincide' : 'Abre tu primer expediente'} message={q ? 'Prueba con otro nombre, correo o teléfono.' : 'Cada expediente reúne al cliente, sus pólizas, sus recibos y sus documentos.'} action={q ? <Link className="button button-soft" href="/crm/clientes">Limpiar búsqueda</Link> : newButton ?? undefined}/>}
    {total > PAGE ? <div className="document-pagination">{skip > 0 ? <Link href={`?q=${encodeURIComponent(q)}&page=${page - 1}`}>Anterior</Link> : <span/>}<span>{skip + 1}–{Math.min(skip + PAGE, total)} de {total}</span>{skip + PAGE < total ? <Link href={`?q=${encodeURIComponent(q)}&page=${page + 1}`}>Siguiente</Link> : <span/>}</div> : null}
  </>;
}
