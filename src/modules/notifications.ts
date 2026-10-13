// Pure wording for notification events; shared by the API tests and the browser.
export type NotificationEvent = { id: string; action: string; module: string; recordId: string; label: string; actorName: string; createdAt: string };
const verbs: Record<string, string> = { created: 'registró', updated: 'actualizó', archived: 'archivó', restored: 'restauró', deleted: 'eliminó', uploaded: 'subió', moved: 'movió', renamed: 'renombró' };
const ownVerbs: Record<string, string> = { created: 'Registraste', updated: 'Actualizaste', archived: 'Archivaste', restored: 'Restauraste', deleted: 'Eliminaste', uploaded: 'Subiste', moved: 'Moviste', renamed: 'Renombraste' };
const nouns: Record<string, string> = { prospectos: 'el prospecto', clientes: 'el cliente', polizas: 'la póliza', cotizaciones: 'la cotización', pagos: 'el recibo', renovaciones: 'la renovación', siniestros: 'el siniestro', actividades: 'la actividad', documentos: 'el archivo', carpetas: 'la carpeta', expedientes: 'el expediente', productos: 'el producto', entregas: 'la entrega de' };
export function describeEvent(event: Pick<NotificationEvent, 'action' | 'module' | 'label' | 'actorName'>, own = false) {
  if (own) return `${ownVerbs[event.action] ?? 'Modificaste'} ${nouns[event.module] ?? 'el registro'} «${event.label}»`;
  return `${event.actorName} ${verbs[event.action] ?? 'modificó'} ${nouns[event.module] ?? 'el registro'} «${event.label}»`;
}
export function eventHref(event: Pick<NotificationEvent, 'action' | 'module' | 'recordId'>) {
  if (event.action === 'deleted') return null;
  if (event.module === 'clientes' || event.module === 'expedientes') return `/crm/clientes/${encodeURIComponent(event.recordId)}`;
  if (event.module === 'documentos' || event.module === 'carpetas') return '/crm/documentos';
  return `/crm/${event.module}`;
}
