export type AccessRole = 'USER' | 'ADMIN' | 'SUPERADMIN';
export function normalizeEmail(email: string) { return email.trim().toLowerCase(); }
export function permittedRole(grant: { role: AccessRole; enabled: boolean } | null, emailVerified: boolean, email: string, superadminEmail?: string): AccessRole | null {
  if (!grant?.enabled || !emailVerified) return null;
  if (grant.role === 'SUPERADMIN' && normalizeEmail(email) !== normalizeEmail(superadminEmail ?? '')) return null;
  return grant.role;
}
export function hasRole(actual: AccessRole, minimum: AccessRole) {
  const rank = { USER: 0, ADMIN: 1, SUPERADMIN: 2 };
  return rank[actual] >= rank[minimum];
}
export function trustedMutation(request: Request, baseUrl: string) {
  if (['GET','HEAD','OPTIONS'].includes(request.method)) return true;
  try { return request.headers.get('origin') === new URL(baseUrl).origin; } catch { return false; }
}
