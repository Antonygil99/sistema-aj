import { z } from 'zod';
export const prospectStatuses = ['NEW', 'CONTACTED', 'QUALIFIED', 'WON', 'LOST'] as const;
export const statusLabels = { NEW: 'Nuevo', CONTACTED: 'Contactado', QUALIFIED: 'Calificado', WON: 'Ganado', LOST: 'Perdido' };
export const contactQuerySchema = z.object({ q: z.string().trim().max(100).default(''), status: z.enum(prospectStatuses).optional() }).strict();
export type ContactQuery = z.infer<typeof contactQuerySchema>;
export function contactWhere(query: ContactQuery, prospect: boolean) {
  const search = query.q ? { OR: ['name', 'email', 'phone'].map(field => ({ [field]: { contains: query.q, mode: 'insensitive' as const } })) } : {};
  return { ...search, ...(prospect && query.status ? { status: query.status } : {}) };
}
