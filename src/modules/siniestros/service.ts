import { getDb } from '@/lib/db';
import { createSchema } from './schema';
export async function list(take: number, skip: number) {
  const db = getDb();
  const [data, total] = await db.$transaction([
    db.claim.findMany({ take, skip, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
    db.claim.count(),
  ]);
  return { data, total, take, skip };
}
export async function create(input: unknown) {
  return getDb().claim.create({ data: createSchema.parse(input) });
}
