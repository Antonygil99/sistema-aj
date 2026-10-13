'use client';
import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LuChevronRight, LuLayoutDashboard, LuPanelLeftClose, LuPanelLeftOpen, LuUserCog } from 'react-icons/lu';
import { modules, type ModuleSlug } from '@/modules/catalog';
import { moduleIcons } from './module-icons';
import { SignOutButton } from './sign-out-button';
const groups: { label: string; slugs: ModuleSlug[] }[] = [
  { label: 'Relaciones', slugs: ['prospectos', 'clientes', 'cotizaciones'] },
  { label: 'Operación', slugs: ['polizas', 'pagos', 'renovaciones', 'siniestros'] },
  { label: 'Organización', slugs: ['documentos', 'actividades'] },
];
const roles = { USER: 'Usuario', ADMIN: 'Administrador', SUPERADMIN: 'Superadmin' };
export function WorkspaceShell({ children, user }: { children: ReactNode; user: { name: string; role: keyof typeof roles } }) {
  const pathname = usePathname();
  const [compact, setCompact] = useState(false);
  const current = modules.find(item => pathname === `/crm/${item.slug}`);
  const title = current?.label ?? (pathname === '/usuarios' ? 'Usuarios y accesos' : 'Resumen');
  const initials = user.name.trim().split(/\s+/).slice(0, 2).map(part => part.charAt(0)).join('').toUpperCase() || 'AJ';
  return <div className={`shell workspace${compact ? ' is-compact' : ''}`}>
    <a href="#workspace-content" className="workspace-skip">Ir al contenido</a>
    <aside className="workspace-sidebar">
      <div className="sidebar-brand-row"><Link href="/" className="workspace-brand" aria-label="Sistema AJ, inicio"><span className="workspace-mark">aj</span><span className="sidebar-label brand-wordmark">Sistema AJ<small>Tu espacio de trabajo</small></span></Link><button className="sidebar-toggle" aria-label={compact ? 'Ampliar menú' : 'Contraer menú'} aria-expanded={!compact} onClick={() => setCompact(value => !value)}>{compact ? <LuPanelLeftOpen/> : <LuPanelLeftClose/>}</button></div>
      <nav aria-label="Navegación principal" className="workspace-nav">
        <div className="nav-group"><p className="nav-label sidebar-label">Principal</p><Link href="/" aria-current={pathname === '/' ? 'page' : undefined} title="Resumen"><LuLayoutDashboard aria-hidden="true"/><span className="sidebar-label">Resumen</span></Link></div>
        {groups.map(group => <div className="nav-group" key={group.label}><p className="nav-label sidebar-label">{group.label}</p>{group.slugs.map(slug => { const item = modules.find(module => module.slug === slug)!; const Icon = moduleIcons[slug]; return <Link key={slug} href={`/crm/${slug}`} aria-current={pathname === `/crm/${slug}` ? 'page' : undefined} title={item.label}><Icon aria-hidden="true"/><span className="sidebar-label">{item.label}</span></Link>; })}</div>)}
        {user.role === 'SUPERADMIN' ? <div className="nav-group"><p className="nav-label sidebar-label">Administración</p><Link href="/usuarios" aria-current={pathname === '/usuarios' ? 'page' : undefined} title="Usuarios y accesos"><LuUserCog aria-hidden="true"/><span className="sidebar-label">Usuarios y accesos</span></Link></div> : null}
      </nav>
      <div className="sidebar-account"><p className="nav-label sidebar-label">Tu cuenta</p><div className="account-summary"><span className="account-avatar" aria-hidden="true">{initials}</span><div className="sidebar-label account-name"><strong>{user.name}</strong><small>{roles[user.role]}</small></div></div><div className="account-signout"><SignOutButton/></div></div>
    </aside>
    <div className="main workspace-main"><header className="workspace-topbar"><div className="workspace-breadcrumb"><Link href="/">Espacio AJ</Link><LuChevronRight aria-hidden="true"/><span>{title}</span></div><div className="workspace-access"><span className="access-dot"/>Acceso privado<div className="mobile-signout"><SignOutButton/></div></div></header><main id="workspace-content" tabIndex={-1} className="workspace-content">{children}</main><footer className="workspace-footer"><span>Sistema AJ</span><span>Seguros, relaciones y seguimiento.</span></footer></div>
  </div>;
}
