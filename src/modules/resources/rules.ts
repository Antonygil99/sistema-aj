// Pure request rules for the generic CRM tables (validation, search filters, full-form updates). Unit tested.
import { z } from 'zod';
import { resources, type ResourceSlug } from './config';
import { createSchema as prospectSchema, updateSchema as prospectUpdateSchema } from '../prospectos/schema';
import { applyProspectRules } from '../prospectos/pipeline';
import { createSchema as clientSchema } from '../clientes/schema';
import { createSchema as policySchema } from '../polizas/schema';
import { createSchema as quoteSchema } from '../cotizaciones/schema';
import { createSchema as paymentSchema } from '../pagos/schema';
import { createSchema as renewalSchema } from '../renovaciones/schema';
import { createSchema as claimSchema } from '../siniestros/schema';
import { createSchema as activitySchema } from '../actividades/schema';
import { createSchema as productSchema } from '../productos/schema';

export class ResourceError extends Error {
  constructor(public readonly code: string, public readonly status: number) { super(code); }
}
export const schemas: Record<ResourceSlug, z.ZodType> = {
  prospectos: prospectSchema, clientes: clientSchema, polizas: policySchema, cotizaciones: quoteSchema,
  pagos: paymentSchema, renovaciones: renewalSchema, siniestros: claimSchema, actividades: activitySchema, productos: productSchema,
};
// Tables whose edit form accepts more than their create form (a converted prospect keeps CLIENTE).
const updateSchemas: Partial<Record<ResourceSlug, z.ZodType>> = { prospectos: prospectUpdateSchema };
// Business rules applied on every create and full-form update.
export function applyRules(slug: ResourceSlug, data: Record<string, unknown>) {
  return slug === 'prospectos' ? applyProspectRules(data) : data;
}
export const searchFields: Record<ResourceSlug, string[]> = {
  prospectos: ['name', 'email', 'phone'], clientes: ['name', 'email', 'phone', 'taxId'],
  polizas: ['number', 'insurer', 'product', 'coverage', 'vehicle', 'plates', 'client.name'], cotizaciones: ['reference', 'product', 'client.name', 'prospect.name'],
  pagos: ['policy.number', 'policy.client.name'], renovaciones: ['policy.number', 'policy.client.name', 'notes'],
  siniestros: ['reference', 'description', 'policy.number'], actividades: ['title', 'description'],
  productos: ['name', 'insurer', 'description'],
};
export const listQuery = z.object({
  take: z.coerce.number().int().min(1).max(100).default(20), skip: z.coerce.number().int().min(0).max(100000).default(0),
  q: z.string().trim().max(100).default(''), status: z.string().max(40).optional(), archived: z.enum(['0', '1']).default('0'),
}).strict();
// "policy.client.name" -> { policy: { client: { name: { contains, mode } } } }
function searchClause(path: string, q: string): object {
  return path.split('.').reduceRight<object>((inner, key) => ({ [key]: inner }), { contains: q, mode: 'insensitive' });
}
export function listFilter(slug: ResourceSlug, input: unknown) {
  const query = listQuery.parse(input);
  const statuses = resources[slug].statuses;
  if (query.status && !(statuses && Object.hasOwn(statuses, query.status))) throw new ResourceError('INVALID_STATUS', 400);
  const where = {
    archivedAt: query.archived === '1' ? { not: null } : null,
    ...(query.status ? { status: query.status } : {}),
    ...(query.q ? { OR: searchFields[slug].map(path => searchClause(path, query.q)) } : {}),
  };
  return { query, where };
}
const version = z.object({ expectedUpdatedAt: z.iso.datetime({ offset: true }) }).loose();
// Full-form update: requires the version the user edited; optional fields left out become null.
export function parseUpdate(slug: ResourceSlug, input: unknown) {
  const { expectedUpdatedAt, ...rest } = version.parse(input);
  const parsed = (updateSchemas[slug] ?? schemas[slug]).parse(rest) as Record<string, unknown>;
  return { expectedUpdatedAt: new Date(expectedUpdatedAt), data: applyRules(slug, { ...Object.fromEntries(resources[slug].nullable.map(name => [name, null])), ...parsed }) };
}
export const archiveInput = z.object({ archived: z.boolean() }).strict();
// The medical-history note is only for the advisors who operate the CRM (Ale and Joel), never for read-only accounts.
export function redact<T extends Record<string, unknown>>(slug: ResourceSlug, row: T, role: string): T {
  if (slug !== 'prospectos' || role !== 'USER' || !('diagMedicalHistory' in row)) return row;
  const { diagMedicalHistory: _hidden, ...rest } = row;
  void _hidden;
  return rest as T;
}
