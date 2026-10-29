import {Select} from '@/components/ui/select';
import Link from 'next/link';
import { requireUser } from '@/lib/session';
import { auditActions, auditDetail, auditFilters, auditModules, auditRoles } from '@/modules/audit';
import { auditHistory } from '@/modules/audit-server';

type Search = Record<string, string | string[] | undefined>;
const dateFormat = new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City', dateStyle: 'short', timeStyle: 'medium' });
export default async function Logs({ searchParams }: { searchParams: Promise<Search> }) {
  await requireUser('SUPERADMIN');
  const search = await searchParams;
  const parsed = auditFilters.safeParse(Object.fromEntries(Object.entries(search).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value])));
  if (!parsed.success) return <><div className="eyebrow">ADMINISTRACIÓN</div><h1>Registro de actividad</h1><p role="alert">Revisa los filtros: usa fechas válidas, con el inicio anterior al final.</p><Link href="/logs" className="button">Restablecer filtros</Link></>;
  const filters = parsed.data;
  const { data, total, page, pageSize } = await auditHistory(filters);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const pageHref = (next: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) if (value && key !== 'page') params.set(key, String(value));
    params.set('page', String(next));
    return `/logs?${params}`;
  };
  return <>
    <div className="eyebrow">ADMINISTRACIÓN</div><h1>Registro de actividad</h1>
    <p>Consulta las acciones del equipo de los últimos tres días, quién las realizó y cuándo. Los registros más antiguos se eliminan automáticamente. Solo el superadmin puede ver este historial.</p>
    <form action="/logs" className="resource-filters audit-filters">
      <label className="search-field"><span>Buscar persona o registro</span><input name="q" defaultValue={filters.q} placeholder="Nombre, correo o registro" maxLength={120}/></label>
      <label>Acción<Select name="action" defaultValue={filters.action ?? ''}><option value="">Todas las acciones</option>{Object.entries(auditActions).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select></label>
      <label>Módulo<Select name="module" defaultValue={filters.module ?? ''}><option value="">Todos los módulos</option>{Object.entries(auditModules).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select></label>
      <label>Rol al realizar la acción<Select name="role" defaultValue={filters.role ?? ''}><option value="">Todos los roles</option>{Object.entries(auditRoles).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select></label>
      <label>Desde<input type="date" name="from" defaultValue={filters.from}/></label>
      <label>Hasta<input type="date" name="to" defaultValue={filters.to}/></label>
      <button className="button" type="submit">Filtrar</button><Link href="/logs" className="text-button">Limpiar filtros</Link>
    </form>
    <div className="resource-toolbar"><span className="resource-count">{total} acciones registradas</span><Link href={pageHref(page)} className="text-button">Actualizar</Link></div>
    <div className="table-wrap"><table><caption className="sr-only">Historial de acciones del equipo</caption><thead><tr><th>Fecha y hora (CDMX)</th><th>Persona</th><th>Rol</th><th>Acción</th><th>Módulo</th><th>Registro / detalle</th></tr></thead><tbody>
      {data.map(event => <tr key={event.id}>
        <td><time dateTime={event.createdAt.toISOString()}>{dateFormat.format(event.createdAt)}</time></td>
        <td><strong>{event.actorName}</strong><br/><small>{event.actorEmail ?? (event.actorId ? 'Correo no registrado' : 'Integración interna')}</small></td>
        <td>{event.actorRole ? auditRoles[event.actorRole] : 'No registrado'}</td>
        <td>{auditActions[event.action as keyof typeof auditActions] ?? event.action}</td><td>{auditModules[event.module] ?? event.module}</td>
        <td><span>{event.label}</span><br/><small>ID: {event.recordId}</small>{auditDetail(event.details) ? <p className="audit-detail">{auditDetail(event.details)}</p> : null}</td>
      </tr>)}
      {data.length === 0 ? <tr><td colSpan={6}>No hay acciones que coincidan con estos filtros.</td></tr> : null}
    </tbody></table></div>
    <nav className="resource-toolbar audit-pagination" aria-label="Páginas del historial">
      {page > 1 ? <Link className="text-button" href={pageHref(page - 1)}>Anterior</Link> : null}
      <span>Página {page} de {pages}</span>{page < pages ? <Link className="text-button" href={pageHref(page + 1)}>Siguiente</Link> : null}
    </nav>
    <p className="lead-small">Los registros anteriores pueden no tener el rol original. Las descargas indican que se autorizó el enlace del archivo. Las fechas y los filtros usan la hora de Ciudad de México.</p>
  </>;
}
