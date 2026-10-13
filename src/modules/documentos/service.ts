import { getDb } from '@/lib/db';
export async function list(take: number, skip: number) {
  const db = getDb();
  const where = { archivedAt: null };
  const [data, total] = await db.$transaction([
    // Bucket keys stay server-side; downloads go through /api/documents/[id]/download.
    db.document.findMany({ where, take: Math.min(Math.max(take, 1), 100), skip: Math.max(skip, 0), orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], omit: { storageKey: true } }),
    db.document.count({ where }),
  ]);
  return { data, total, take, skip };
}
