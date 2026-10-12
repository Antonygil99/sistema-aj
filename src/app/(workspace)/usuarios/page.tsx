import { requireUser } from '@/lib/session';
import { getDb } from '@/lib/db';
import { UserManager } from '@/components/user-manager';
export default async function Users() {
  await requireUser('SUPERADMIN');
  const grants = await getDb().accessGrant.findMany({ select: { id: true, email: true, role: true, enabled: true }, orderBy: { createdAt: 'asc' } });
  return <><div className="eyebrow">ADMINISTRACIÓN</div><h1>Usuarios y accesos</h1><p>Gestiona quién puede entrar al equipo y operar el CRM. Los cambios quedan registrados.</p><UserManager initial={grants}/></>;
}
