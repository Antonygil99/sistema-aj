import { getDb } from '@/lib/db';
import { createSchema } from './schema';
import { contactWhere, type ContactQuery } from '../shared/contact-list';
import { clientUpdate, ContactError } from '../shared/contact-update';
export async function list(take: number, skip: number, query: ContactQuery = { q: '' }) {
  const db = getDb();
  const where = contactWhere(query, false);
  const [data, total] = await db.$transaction([
    db.client.findMany({ where, take, skip, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
    db.client.count({ where }),
  ]);
  return { data, total, take, skip };
}
export async function find(id: string) { return getDb().client.findUnique({ where: { id } }); }
export async function update(id: string, input: unknown) {
  const { expectedUpdatedAt, data } = clientUpdate(input);
  return getDb().$transaction(async tx => {
    const result = await tx.client.updateMany({ where: { id, updatedAt: expectedUpdatedAt }, data });
    if (!result.count) {
      const exists = await tx.client.findUnique({ where: { id }, select: { id: true } });
      throw new ContactError(exists ? 'RECORD_CHANGED' : 'RECORD_NOT_FOUND', exists ? 409 : 404);
    }
    return tx.client.findUniqueOrThrow({ where: { id } });
  });
}
export async function create(input: unknown) {
  return getDb().client.create({ data: createSchema.parse(input) });
}
