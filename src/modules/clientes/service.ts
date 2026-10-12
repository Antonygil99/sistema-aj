import { getDb } from '@/lib/db';
import { createSchema } from './schema';
export async function list(take: number, skip: number) {
  const db = getDb();
  const [data, total] = await db.$transaction([
    db.client.findMany({ take, skip, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
    db.client.count(),
  ]);
  return { data, total, take, skip };
}
export async function create(input: unknown) {
  return getDb().client.create({ data: createSchema.parse(input) });
}
