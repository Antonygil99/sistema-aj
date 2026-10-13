import 'server-only';
import { cache } from 'react';
import { headers } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { getAuth } from './auth';
import { getDb } from './db';
import { hasRole, normalizeEmail, permittedRole, type AccessRole } from './access-policy';
export async function currentUser(requestHeaders: Headers) {
  const auth = getAuth();
  if (!auth) return null;
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) return null;
  const grant = await getDb().accessGrant.findUnique({ where: { email: normalizeEmail(session.user.email) } });
  const role = permittedRole(grant, session.user.emailVerified, session.user.email, process.env.AJ_SUPERADMIN_EMAIL);
  if (!role) return null;
  return { id: session.user.id, name: session.user.name, email: session.user.email, image: session.user.image ?? null, role };
}
export const pageUser = cache(async () => currentUser(await headers()));
export async function requireUser(minimum: AccessRole = 'USER') {
  const user = await pageUser();
  if (!user) redirect('/login');
  if (!hasRole(user.role, minimum)) notFound();
  return user;
}
