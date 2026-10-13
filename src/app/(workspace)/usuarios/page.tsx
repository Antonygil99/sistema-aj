import { requireUser } from '@/lib/session';
import { getDb } from '@/lib/db';
import { normalizeEmail } from '@/lib/access-policy';
import { UserManager } from '@/components/user-manager';
export default async function Users() {
  await requireUser('SUPERADMIN');
  const db = getDb();
  const grants = await db.accessGrant.findMany({ select: { id: true, email: true, role: true, enabled: true }, orderBy: { createdAt: 'asc' } });
  // Google profile (name and photo) exists only after the person's first sign-in.
  const profiles = await db.authUser.findMany({ where: { email: { in: grants.map(grant => grant.email) } }, select: { email: true, name: true, image: true } });
  const byEmail = new Map(profiles.map(profile => [normalizeEmail(profile.email), profile]));
  const rows = grants.map(grant => { const profile = byEmail.get(normalizeEmail(grant.email)); return { ...grant, name: profile?.name ?? null, image: profile?.image ?? null }; });
  return <><div className="eyebrow">ADMINISTRACIÓN</div><h1>Usuarios y accesos</h1><p>Gestiona quién puede entrar al equipo y operar el CRM. Los cambios quedan registrados.</p><UserManager initial={rows}/></>;
}
