'use client';
import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight3, Category, SidebarLeft, SidebarRight, UserOctagon } from 'iconsax-reactjs';
import { modules, type ModuleSlug } from '@/modules/catalog';
import { moduleIcons } from './module-icons';
import { SignOutButton } from './sign-out-button';
import { ToastProvider } from './ui/toast';
import { ConfirmProvider } from './ui/confirm';
import { UploadProvider } from './ui/upload-manager';
import { NotificationCenter } from './ui/notifications';
import { MobileNav } from './ui/mobile-nav';
import { CommandSearch } from './ui/command-search';
const groups: { label: string; slugs: ModuleSlug[] }[] = [
  { label: 'Relaciones', slugs: ['prospectos', 'clientes', 'cotizaciones'] },
  { label: 'Operación', slugs: ['polizas', 'pagos', 'renovaciones', 'siniestros'] },
  { label: 'Organización', slugs: ['documentos', 'actividades'] },
];
const roles = { USER: 'Usuario', ADMIN: 'Administrador', SUPERADMIN: 'Superadmin' };
export function WorkspaceShell({ children, user }: { children: ReactNode; user: { name: string; role: keyof typeof roles } }) {
  const pathname = usePathname();
  const [compact, setCompact] = useState(false);
  const current = modules.find(item => pathname === `/crm/${item.slug}` || pathname.startsWith(`/crm/${item.slug}/`));
  const title = current?.label ?? (pathname === '/usuarios' ? 'Usuarios y accesos' : 'Resumen');
  const initials = user.name.trim().split(/\s+/).slice(0, 2).map(part => part.charAt(0)).join('').toUpperCase() || 'AJ';
  return <div className={`shell workspace${compact ? ' is-compact' : ''}`}><ToastProvider><ConfirmProvider><UploadProvider>
    <a href="#workspace-content" className="workspace-skip">Ir al contenido</a>
    <aside className="workspace-sidebar">
      <div className="sidebar-brand-row"><Link href="/" className="workspace-brand" aria-label="Sistema AJ, inicio"><span className="workspace-mark">aj</span><span className="sidebar-label brand-wordmark">Sistema AJ<small>Tu espacio de trabajo</small></span></Link><button className="sidebar-toggle" aria-label={compact ? 'Ampliar menú' : 'Contraer menú'} aria-expanded={!compact} onClick={() => setCompact(value => !value)}>{compact ? <SidebarRight/> : <SidebarLeft/>}</button></div>
      <nav aria-label="Navegación principal" className="workspace-nav">
        <div className="nav-group"><p className="nav-label sidebar-label">Principal</p><Link href="/" aria-current={pathname === '/' ? 'page' : undefined} title="Resumen"><Category aria-hidden="true"/><span className="sidebar-label">Resumen</span></Link></div>
        {groups.map(group => <div className="nav-group" key={group.label}><p className="nav-label sidebar-label">{group.label}</p>{group.slugs.map(slug => { const item = modules.find(module => module.slug === slug)!; const Icon = moduleIcons[slug]; return <Link key={slug} href={`/crm/${slug}`} aria-current={pathname === `/crm/${slug}` ? 'page' : undefined} title={item.label}><Icon aria-hidden="true"/><span className="sidebar-label">{item.label}</span></Link>; })}</div>)}
        {user.role === 'SUPERADMIN' ? <div className="nav-group"><p className="nav-label sidebar-label">Administración</p><Link href="/usuarios" aria-current={pathname === '/usuarios' ? 'page' : undefined} title="Usuarios y accesos"><UserOctagon aria-hidden="true"/><span className="sidebar-label">Usuarios y accesos</span></Link></div> : null}
      </nav>
      <div className="sidebar-account"><p className="nav-label sidebar-label">Tu cuenta</p><div className="account-summary"><span className="account-avatar" aria-hidden="true">{initials}</span><div className="sidebar-label account-name"><strong>{user.name}</strong><small>{roles[user.role]}</small></div></div><div className="account-signout"><SignOutButton/></div></div>
    </aside>
    <div className="main workspace-main"><header className="workspace-topbar"><div className="workspace-breadcrumb"><Link href="/">Espacio AJ</Link><ArrowRight3 aria-hidden="true"/><span>{title}</span></div><div className="workspace-access"><span className="access-dot"/><span className="access-label">Acceso privado</span><NotificationCenter/><CommandSearch role={user.role}/></div></header><main id="workspace-content" tabIndex={-1} className="workspace-content">{children}</main><footer className="workspace-footer"><span>Sistema AJ</span><span>Seguros, relaciones y seguimiento.</span></footer></div>
    <MobileNav groups={groups} user={{ name: user.name, role: user.role, roleLabel: roles[user.role] }}/>
    </UploadProvider></ConfirmProvider></ToastProvider><div id="workspace-portal" className="workspace-portal"/>
  </div>;
}
