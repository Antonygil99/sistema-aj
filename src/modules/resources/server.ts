import 'server-only';
import { getDb } from '@/lib/db';
import { getR2 } from '@/integrations/r2/server';
import { isProductImageKey } from '../documentos/file-policy';
import type { ResourceSlug } from './config';
import { listFilter, parseUpdate, ResourceError, schemas } from './rules';
export { ResourceError };

type Stored = Record<string, unknown> & { id: string };
// Minimal shape shared by the Prisma delegates used here; keeps the generic layer typed without `any`.
type Delegate = {
  findMany(args: object): Promise<Stored[]>; count(args: object): Promise<number>; findUnique(args: object): Promise<Stored | null>;
  create(args: object): Promise<Stored>; updateMany(args: object): Promise<{ count: number }>; delete(args: object): Promise<Stored>;
};
const policyWithClient = { select: { id: true, number: true, client: { select: { id: true, name: true } } } };
const productSummary = { select: { id: true, name: true, insurer: true, imageType: true, updatedAt: true } };
const definitions: Record<ResourceSlug, { model: string; include?: object; omit?: object; orderBy: object[] }> = {
  prospectos: { model: 'prospect', orderBy: [{ createdAt: 'desc' }] },
  clientes: { model: 'client', orderBy: [{ createdAt: 'desc' }] },
  polizas: { model: 'policy', include: { client: { select: { id: true, name: true } }, catalogProduct: productSummary }, orderBy: [{ endDate: 'asc' }] },
  cotizaciones: { model: 'quote', include: { client: { select: { id: true, name: true } }, prospect: { select: { id: true, name: true } } }, orderBy: [{ createdAt: 'desc' }] },
  pagos: { model: 'payment', include: { policy: policyWithClient }, orderBy: [{ dueDate: 'asc' }] },
  renovaciones: { model: 'renewal', include: { policy: policyWithClient }, orderBy: [{ dueDate: 'asc' }] },
  siniestros: { model: 'claim', include: { policy: policyWithClient }, orderBy: [{ occurredAt: 'desc' }] },
  // Bucket keys never reach the browser; imageType tells whether an image exists.
  productos: { model: 'product', omit: { imageKey: true }, orderBy: [{ name: 'asc' }] },
  actividades: { model: 'activity', include: { client: { select: { id: true, name: true } }, prospect: { select: { id: true, name: true } }, policy: { select: { id: true, number: true } }, claim: { select: { id: true, reference: true } } }, orderBy: [{ dueDate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }] },
};
function delegate(client: unknown, slug: ResourceSlug) { return (client as Record<string, Delegate>)[definitions[slug].model]; }
const withInclude = (slug: ResourceSlug) => ({ ...(definitions[slug].include ? { include: definitions[slug].include } : {}), ...(definitions[slug].omit ? { omit: definitions[slug].omit } : {}) });

export async function listResource(slug: ResourceSlug, input: unknown) {
  const { query, where } = listFilter(slug, input);
  const db = getDb(), model = delegate(db, slug);
  const [data, total] = await Promise.all([
    model.findMany({ where, take: query.take, skip: query.skip, orderBy: [...definitions[slug].orderBy, { id: 'desc' }], ...withInclude(slug) }),
    model.count({ where }),
  ]);
  return { data, total, take: query.take, skip: query.skip };
}
// Global search: a few active matches per table, without counting.
export async function searchResource(slug: ResourceSlug, q: string, take = 5) {
  const { where } = listFilter(slug, { q, take });
  return delegate(getDb(), slug).findMany({ where, take, orderBy: [...definitions[slug].orderBy, { id: 'desc' }], ...withInclude(slug) });
}
export async function findResource(slug: ResourceSlug, id: string) {
  return delegate(getDb(), slug).findUnique({ where: { id }, ...withInclude(slug) });
}
export async function createResource(slug: ResourceSlug, input: unknown) {
  const data = schemas[slug].parse(input) as Record<string, unknown>;
  // A policy from the catalog inherits the product's responsible (Ale for medical, Joel for autos) unless one was chosen.
  if (slug === 'polizas' && data.productId && !data.ownerEmail) {
    const product = await getDb().product.findUnique({ where: { id: String(data.productId) }, select: { ownerEmail: true } });
    if (product?.ownerEmail) data.ownerEmail = product.ownerEmail;
  }
  return delegate(getDb(), slug).create({ data, ...withInclude(slug) });
}
// Optimistic concurrency: the update only applies to the version the user edited.
export async function updateResource(slug: ResourceSlug, id: string, input: unknown) {
  const { expectedUpdatedAt, data } = parseUpdate(slug, input);
  return getDb().$transaction(async tx => {
    const result = await delegate(tx, slug).updateMany({ where: { id, updatedAt: expectedUpdatedAt }, data });
    if (!result.count) {
      const exists = await delegate(tx, slug).findUnique({ where: { id }, select: { id: true } });
      throw new ResourceError(exists ? 'RECORD_CHANGED' : 'RECORD_NOT_FOUND', exists ? 409 : 404);
    }
    return delegate(tx, slug).findUnique({ where: { id }, ...withInclude(slug) });
  });
}
export async function archiveResource(slug: ResourceSlug, id: string, archived: boolean) {
  const db = getDb();
  const result = await delegate(db, slug).updateMany({ where: { id, archivedAt: archived ? null : { not: null } }, data: { archivedAt: archived ? new Date() : null } });
  if (!result.count) {
    const exists = await delegate(db, slug).findUnique({ where: { id }, select: { id: true } });
    throw new ResourceError(exists ? 'ALREADY_IN_STATE' : 'RECORD_NOT_FOUND', exists ? 409 : 404);
  }
  return findResource(slug, id);
}
// Permanent removal for records without dependents; restricted relations make the database refuse otherwise.
export async function deleteResource(slug: ResourceSlug, id: string) {
  // A deleted catalog product takes its stored image with it (after the row is gone).
  const image = slug === 'productos' ? (await getDb().product.findUnique({ where: { id }, select: { imageKey: true } }))?.imageKey : null;
  try {
    const record = await getDb().$transaction(async tx => {
      const record = await delegate(tx, slug).findUnique({ where: { id }, ...withInclude(slug) });
      if (!record) throw new ResourceError('RECORD_NOT_FOUND', 404);
      if (slug === 'clientes') {
        // Default dossier folders are not content: remove them only when no file lives inside.
        if (await tx.document.count({ where: { folder: { clientId: id } } })) throw new ResourceError('HAS_RELATIONS', 409);
        const folders = await tx.documentFolder.findMany({ where: { clientId: id }, select: { id: true, parentId: true } });
        for (const folder of orderLeavesFirst(folders)) await tx.documentFolder.delete({ where: { id: folder.id } });
      }
      await delegate(tx, slug).delete({ where: { id } });
      return record;
    });
    if (image && isProductImageKey(image)) await getR2().remove(image).catch(() => console.error('R2_ORPHAN_CLEANUP_REQUIRED'));
    return record;
  } catch (error) {
    if (isForeignKeyError(error)) throw new ResourceError('HAS_RELATIONS', 409);
    throw error;
  }
}
export function orderLeavesFirst<T extends { id: string; parentId: string | null }>(folders: T[]) {
  const depth = (folder: T) => { let level = 0, parent = folder.parentId; const seen = new Set<string>(); while (parent && !seen.has(parent)) { seen.add(parent); level++; parent = folders.find(item => item.id === parent)?.parentId ?? null; } return level; };
  return [...folders].sort((a, b) => depth(b) - depth(a));
}
export function isForeignKeyError(error: unknown) {
  const value = error as { code?: unknown; cause?: { code?: unknown; originalCode?: unknown }; message?: unknown };
  return value?.code === 'P2003' || value?.cause?.originalCode === '23503' || value?.cause?.code === '23503' || (typeof value?.message === 'string' && /foreign key/i.test(value.message));
}
