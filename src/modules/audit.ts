import { z } from 'zod';
export const auditActions = {
  created: 'Creación', updated: 'Actualización', archived: 'Archivado', restored: 'Restauración', deleted: 'Eliminación', uploaded: 'Carga de archivo', moved: 'Movimiento', renamed: 'Cambio de nombre', downloaded: 'Descarga de archivo', viewed: 'Consulta', signed_in: 'Inicio de sesión', signed_out: 'Cierre de sesión', access_changed: 'Cambio de acceso',
} as const;
export const auditModules: Record<string, string> = { prospectos: 'Prospectos', clientes: 'Clientes', polizas: 'Pólizas', cotizaciones: 'Cotizaciones', pagos: 'Pagos', renovaciones: 'Renovaciones', siniestros: 'Siniestros', actividades: 'Actividades', documentos: 'Documentos', carpetas: 'Carpetas', expedientes: 'Expedientes', productos: 'Productos', entregas: 'Entregas', usuarios: 'Usuarios y accesos', sesiones: 'Sesiones', preferencias: 'Preferencias' };
export const auditRoles = { USER: 'Usuario', ADMIN: 'Administrador', SUPERADMIN: 'Superadmin' };
const optional = <T extends z.ZodType>(schema: T) => z.preprocess(value => value === '' ? undefined : value, schema.optional());
export const auditFilters = z.object({
  q: z.string().trim().max(120).default(''),
  action: optional(z.enum(Object.keys(auditActions) as [keyof typeof auditActions, ...(keyof typeof auditActions)[]])),
  module: optional(z.string().refine(value => Object.hasOwn(auditModules, value))),
  role: optional(z.enum(['USER', 'ADMIN', 'SUPERADMIN'])),
  from: optional(z.iso.date()), to: optional(z.iso.date()),
  page: z.coerce.number().int().min(1).max(10000).default(1),
}).refine(value => !value.from || !value.to || value.from <= value.to, { message: 'La fecha inicial debe ser anterior a la final.', path: ['from'] });
export type AuditFilters = z.infer<typeof auditFilters>;
export const auditPageSize = 50;
const accessState = z.object({ role: z.enum(['USER', 'ADMIN', 'SUPERADMIN']), enabled: z.boolean() });
export function auditDetail(details: unknown) {
  const change = z.object({ before: accessState.nullable(), after: accessState }).safeParse(details);
  const describe = (state: z.infer<typeof accessState>) => `${auditRoles[state.role]} · ${state.enabled ? 'Activo' : 'Desactivado'}`;
  if (change.success) return `${change.data.before ? describe(change.data.before) : 'Sin acceso previo'} → ${describe(change.data.after)}`;
  const legacy = accessState.safeParse(details);
  return legacy.success ? describe(legacy.data) : null;
}
export function auditWhere(filters: AuditFilters) {
  // Match the platform's Mexico City calendar (UTC-6) and include the entire final day.
  return {
    ...(filters.q ? { OR: ['actorName', 'actorEmail', 'label', 'recordId'].map(field => ({ [field]: { contains: filters.q, mode: 'insensitive' as const } })) } : {}),
    ...(filters.action ? { action: filters.action } : {}),
    ...(filters.module ? { module: filters.module } : {}),
    ...(filters.role ? { actorRole: filters.role } : {}),
    ...((filters.from || filters.to) ? { createdAt: {
      ...(filters.from ? { gte: new Date(`${filters.from}T00:00:00-06:00`) } : {}),
      ...(filters.to ? { lt: new Date(new Date(`${filters.to}T00:00:00-06:00`).getTime() + 86400000) } : {}),
    } } : {}),
  };
}
