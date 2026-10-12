import { getDb } from '@/lib/db';
import { createSchema } from './schema';
export async function list(take: number, skip: number) {
  const db = getDb();
  const [data, total] = await db.$transaction([
    db.prospect.findMany({ take, skip, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
    db.prospect.count(),
  ]);
  return { data, total, take, skip };
}
export async function create(input: unknown) {
  return getDb().prospect.create({ data: createSchema.parse(input) });
}
