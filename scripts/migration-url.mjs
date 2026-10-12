/** @param {Record<string, string | undefined>} env */
export function migrationUrl(env) {
  const value = env.DIRECT_URL || env.DATABASE_URL || env.DATA_URL;
  if (!value) return undefined;
  let url;
  try { url = new URL(value); } catch { throw new Error('DATABASE_URL_INVALID'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('POSTGRESQL_TCP_URL_REQUIRED');
  // Prisma documents identical credentials for its pooled and direct endpoints.
  // Only this documented hostname is converted; other providers stay unchanged.
  if (!env.DIRECT_URL && url.hostname === 'pooled.db.prisma.io') url.hostname = 'db.prisma.io';
  return url.toString();
}
