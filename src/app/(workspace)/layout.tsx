import Link from 'next/link';
import { modules } from '@/modules/catalog';
import { requireUser } from '@/lib/session';
import { SignOutButton } from '@/components/sign-out-button';
export const dynamic = 'force-dynamic';
export default async function WorkspaceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser();
  const label = { USER: 'Usuario', ADMIN: 'Administrador', SUPERADMIN: 'Superadmin' }[user.role];
  return <div className="shell"><aside><Link href="/" className="brand">AJ<span>SISTEMA</span></Link><p className="nav-label">ESPACIO DE TRABAJO</p><nav aria-label="Navegación principal"><Link href="/">◈ &nbsp; Resumen</Link>{modules.map(m => <Link key={m.slug} href={'/crm/' + m.slug}>{m.label}</Link>)}{user.role === 'SUPERADMIN' ? <Link href="/usuarios">Usuarios y accesos</Link> : null}</nav><div className="sidebar-note"><span className="dot"/> Equipo AJ<br/><small>Operación conectada, paso a paso.</small></div></aside><div className="main"><header><span>CRM / Sistema AJ</span><div className="user-menu"><span className="badge">{label}</span><span>{user.name}</span><SignOutButton/></div></header><main>{children}</main><footer>Sistema AJ · Seguros, relaciones y seguimiento.</footer></div></div>;
}
