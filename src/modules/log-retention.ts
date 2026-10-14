import { timingSafeEqual } from 'node:crypto';
export const logRetentionDays = 3;
export function logCutoff(now = new Date()) { return new Date(now.getTime() - logRetentionDays * 86400000); }
export function authorizedCleanup(authorization: string | null, secret: string | undefined) {
  if (!secret || !authorization) return false;
  const expected = Buffer.from(`Bearer ${secret}`), actual = Buffer.from(authorization);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
type ExpiredWhere = { createdAt: { lt: Date } };
type CleanupTransaction = {
  crmEvent: { deleteMany(input: { where: ExpiredWhere }): Promise<{ count: number }> };
  accessAudit: { deleteMany(input: { where: ExpiredWhere }): Promise<{ count: number }> };
};
export async function deleteExpiredLogs(tx: CleanupTransaction, now = new Date()) {
  const cutoff = logCutoff(now), where = { createdAt: { lt: cutoff } };
  const events = await tx.crmEvent.deleteMany({ where });
  const access = await tx.accessAudit.deleteMany({ where });
  return { events: events.count, access: access.count };
}
