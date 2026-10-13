// Pure shaping of global search results (labels, grouping, destinations). Shared by the API, the browser and tests.
import { resources, type ResourceSlug, type Row } from './resources/config';
export type SearchKind = ResourceSlug | 'documentos' | 'carpetas' | 'usuarios';
export type SearchResult = { kind: SearchKind; id: string; title: string; subtitle: string; href: string; download?: boolean };
export const searchOrder: SearchKind[] = ['clientes', 'polizas', 'prospectos', 'documentos', 'carpetas', 'pagos', 'renovaciones', 'siniestros', 'cotizaciones', 'actividades', 'usuarios'];
export const kindLabels: Record<SearchKind, string> = {
  clientes: 'Cliente', polizas: 'Póliza', prospectos: 'Prospecto', cotizaciones: 'Cotización', pagos: 'Recibo', renovaciones: 'Renovación',
  siniestros: 'Siniestro', actividades: 'Actividad', documentos: 'Archivo', carpetas: 'Carpeta', usuarios: 'Usuario',
};
export const groupLabels: Record<SearchKind, string> = {
  clientes: 'Clientes', polizas: 'Pólizas', prospectos: 'Prospectos', cotizaciones: 'Cotizaciones', pagos: 'Recibos', renovaciones: 'Renovaciones',
  siniestros: 'Siniestros', actividades: 'Actividades', documentos: 'Archivos', carpetas: 'Carpetas', usuarios: 'Usuarios y accesos',
};
export const searchQuery = (value: string | null) => (value ?? '').trim().slice(0, 100);
// Clients open their dossier; other tables open their list filtered to the record, with its card already open.
export function resourceResult(slug: ResourceSlug, row: Row): SearchResult {
  const config = resources[slug];
  const title = config.title(row) || 'Sin título';
  const subtitle = config.columns.map(column => column.detail?.(row) || column.value(row)).filter(text => text && text !== title).slice(0, 2).join(' · ');
  const href = slug === 'clientes' ? `/crm/clientes/${encodeURIComponent(row.id)}` : `/crm/${slug}?q=${encodeURIComponent(searchText(slug, row, title))}&open=${encodeURIComponent(row.id)}`;
  return { kind: slug, id: row.id, title, subtitle, href };
}
// The list search must find the record again, so use a field the table actually searches.
function searchText(slug: ResourceSlug, row: Row, title: string) {
  const nested = (path: string) => path.split('.').reduce<unknown>((value, key) => value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined, row);
  if (slug === 'pagos' || slug === 'renovaciones') return String(nested('policy.number') ?? '');
  return title;
}
export function documentResult(row: { id: string; name: string; mimeType: string; client?: { name: string } | null; policy?: { number: string } | null }): SearchResult {
  return { kind: 'documentos', id: row.id, title: row.name, subtitle: ['Descargar', row.client?.name ?? row.policy?.number ?? 'Archivos del equipo'].join(' · '), href: `/api/documents/${encodeURIComponent(row.id)}/download`, download: true };
}
export function folderResult(row: { id: string; name: string; clientId: string | null; client?: { name: string } | null }): SearchResult {
  const params = new URLSearchParams({ folder: row.id, ...(row.clientId ? { clientId: row.clientId } : {}) });
  return { kind: 'carpetas', id: row.id, title: row.name, subtitle: row.client?.name ? `Expediente de ${row.client.name}` : 'Archivos del equipo', href: `/crm/documentos?${params}` };
}
export function userResult(row: { id: string; email: string; role: string; enabled: boolean; name?: string | null }): SearchResult {
  const role = { USER: 'Usuario', ADMIN: 'Administrador', SUPERADMIN: 'Superadmin' }[row.role] ?? row.role;
  return { kind: 'usuarios', id: row.id, title: row.name || row.email, subtitle: [row.name ? row.email : '', role, row.enabled ? '' : 'Desactivado'].filter(Boolean).join(' · '), href: '/usuarios' };
}
export function groupResults(results: SearchResult[]) {
  return searchOrder.map(kind => ({ kind, label: groupLabels[kind], items: results.filter(result => result.kind === kind) })).filter(group => group.items.length);
}
