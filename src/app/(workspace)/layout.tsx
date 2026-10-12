import Link from 'next/link';
import { LuLayoutDashboard, LuUserCog } from 'react-icons/lu';
import { modules } from '@/modules/catalog';
import { requireUser } from '@/lib/session';
import { SignOutButton } from '@/components/sign-out-button';
import { moduleIcons } from '@/components/module-icons';
export const dynamic = 'force-dynamic';
export default async function WorkspaceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser();
  const label = { USER: 'Usuario', ADMIN: 'Administrador', SUPERADMIN: 'Superadmin' }[user.role];
  return <div className="shell"><aside><Link href="/" className="brand">AJ<span>SISTEMA</span></Link><p className="nav-label">ESPACIO DE TRABAJO</p><nav aria-label="Navegación principal"><Link href="/"><LuLayoutDashboard aria-hidden="true"/>Resumen</Link>{modules.map(m => { const Icon = moduleIcons[m.slug]; return <Link key={m.slug} href={'/crm/' + m.slug}><Icon aria-hidden="true"/>{m.label}</Link>; })}{user.role === 'SUPERADMIN' ? <Link href="/usuarios"><LuUserCog aria-hidden="true"/>Usuarios y accesos</Link> : null}</nav><div className="sidebar-note"><span className="dot"/> Equipo AJ<br/><small>Operación conectada, paso a paso.</small></div></aside><div className="main"><header><span>CRM / Sistema AJ</span><div className="user-menu"><span className="badge">{label}</span><span>{user.name}</span><SignOutButton/></div></header><main>{children}</main><footer>Sistema AJ · Seguros, relaciones y seguimiento.</footer></div></div>;
}
