import { getDb } from '@/lib/db';
import { createSchema } from './schema';
export async function list(take: number, skip: number) {
  const db = getDb();
  const [data, total] = await db.$transaction([
    db.activity.findMany({ take, skip, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
    db.activity.count(),
  ]);
  return { data, total, take, skip };
}
export async function create(input: unknown) {
  return getDb().activity.create({ data: createSchema.parse(input) });
}
