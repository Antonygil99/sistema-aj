import { getDb } from '@/lib/db';
import { createSchema } from './schema';
import { contactWhere, type ContactQuery } from '../shared/contact-list';
import { prospectUpdate, ContactError } from '../shared/contact-update';
export async function list(take: number, skip: number, query: ContactQuery = { q: '' }) {
  const db = getDb();
  const where = contactWhere(query, true);
  const [data, total] = await db.$transaction([
    db.prospect.findMany({ where, take, skip, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
    db.prospect.count({ where }),
  ]);
  return { data, total, take, skip };
}
export async function find(id: string) { return getDb().prospect.findUnique({ where: { id } }); }
export async function update(id: string, input: unknown) {
  const { expectedUpdatedAt, data } = prospectUpdate(input);
  return getDb().$transaction(async tx => {
    const result = await tx.prospect.updateMany({ where: { id, updatedAt: expectedUpdatedAt }, data });
    if (!result.count) {
      const exists = await tx.prospect.findUnique({ where: { id }, select: { id: true } });
      throw new ContactError(exists ? 'RECORD_CHANGED' : 'RECORD_NOT_FOUND', exists ? 409 : 404);
    }
    return tx.prospect.findUniqueOrThrow({ where: { id } });
  });
}
export async function create(input: unknown) {
  return getDb().prospect.create({ data: createSchema.parse(input) });
}
