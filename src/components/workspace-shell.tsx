'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight3, Category, SidebarLeft, SidebarRight, UserOctagon } from 'iconsax-reactjs';
import { modules, type ModuleSlug } from '@/modules/catalog';
import { moduleIcons } from './module-icons';
import { AccountMenu, type AccountUser } from './account-menu';
import { ToastProvider } from './ui/toast';
import { ConfirmProvider } from './ui/confirm';
import { UploadProvider } from './ui/upload-manager';
import { NotificationCenter } from './ui/notifications';
import { MobileNav } from './ui/mobile-nav';
import { CommandSearch } from './ui/command-search';
import { PreferencesProvider, usePreferences } from './ui/preferences';
import { TourProvider } from './ui/tours';
import { AccountPanelsProvider } from './ui/account-panels';
import { TooltipLayer } from './ui/tooltip-layer';
import type { Preferences } from '@/modules/preferences';
const groups: { label: string; slugs: ModuleSlug[] }[] = [
  { label: 'Relaciones', slugs: ['prospectos', 'clientes', 'cotizaciones'] },
  { label: 'Operación', slugs: ['polizas', 'entregas', 'pagos', 'renovaciones', 'siniestros'] },
  { label: 'Organización', slugs: ['productos', 'documentos', 'actividades'] },
];
const roles = { USER: 'Usuario', ADMIN: 'Administrador', SUPERADMIN: 'Superadmin' };
export function WorkspaceShell({ children, user, preferences }: { children: ReactNode; user: AccountUser; preferences: Preferences }) {
  return <PreferencesProvider initial={preferences}><WorkspaceFrame user={user}>{children}</WorkspaceFrame></PreferencesProvider>;
}
// The theme attribute is server-rendered on the shell (no flash) and mirrored on <html> for what lives in <body>.
function WorkspaceFrame({ children, user }: { children: ReactNode; user: AccountUser }) {
  const { preferences } = usePreferences();
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = preferences.theme;
    return () => { delete root.dataset.theme; };
  }, [preferences.theme]);
  const pathname = usePathname();
  const [compact, setCompact] = useState(false);
  // After client-side navigation, move focus to the new content so keyboard and screen-reader users start there.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    document.getElementById('workspace-content')?.focus({ preventScroll: true });
  }, [pathname]);
  const current = modules.find(item => pathname === `/crm/${item.slug}` || pathname.startsWith(`/crm/${item.slug}/`));
  const title = current?.label ?? (pathname === '/usuarios' ? 'Usuarios y accesos' : 'Resumen');
  // The gradient theme is the minimal one: icon-only sidebar with tooltips, so it is always compact.
  const iconsOnly = compact || preferences.theme === 'gradient';
  return <div className={`shell workspace${iconsOnly ? ' is-compact' : ''}`} data-theme={preferences.theme}><ToastProvider><ConfirmProvider><UploadProvider><TourProvider role={user.role}><AccountPanelsProvider role={user.role}>
    <a href="#workspace-content" className="workspace-skip">Ir al contenido</a>
    <aside className="workspace-sidebar">
      <div className="sidebar-brand-row"><Link href="/" className="workspace-brand" aria-label="Sistema AJ, inicio"><span className="workspace-mark">aj</span><span className="sidebar-label brand-wordmark">Sistema AJ<small>Tu espacio de trabajo</small></span></Link><button className="sidebar-toggle" aria-label={compact ? 'Ampliar menú' : 'Contraer menú'} aria-expanded={!compact} onClick={() => setCompact(value => !value)}>{compact ? <SidebarRight/> : <SidebarLeft/>}</button></div>
      <nav aria-label="Navegación principal" className="workspace-nav">
        <div className="nav-group"><p className="nav-label sidebar-label">Principal</p><Link href="/" aria-current={pathname === '/' ? 'page' : undefined} aria-label="Resumen" data-tooltip="Resumen"><Category aria-hidden="true"/><span className="sidebar-label">Resumen</span></Link></div>
        {groups.map(group => <div className="nav-group" key={group.label}><p className="nav-label sidebar-label">{group.label}</p>{group.slugs.map(slug => { const item = modules.find(module => module.slug === slug)!; const Icon = moduleIcons[slug]; return <Link key={slug} href={`/crm/${slug}`} aria-current={pathname === `/crm/${slug}` ? 'page' : undefined} aria-label={item.label} data-tooltip={item.label}><Icon aria-hidden="true"/><span className="sidebar-label">{item.label}</span></Link>; })}</div>)}
        {user.role === 'SUPERADMIN' ? <div className="nav-group"><p className="nav-label sidebar-label">Administración</p><Link href="/usuarios" aria-current={pathname === '/usuarios' ? 'page' : undefined} aria-label="Usuarios y accesos" data-tooltip="Usuarios y accesos"><UserOctagon aria-hidden="true"/><span className="sidebar-label">Usuarios y accesos</span></Link></div> : null}
      </nav>
      <div className="sidebar-account"><AccountMenu user={user} roleLabel={roles[user.role]}/></div>
    </aside>
    <div className="main workspace-main"><header className="workspace-topbar"><div className="workspace-breadcrumb"><Link href="/">Espacio AJ</Link><ArrowRight3 aria-hidden="true"/><span>{title}</span></div><div className="workspace-access"><span className="access-dot"/><span className="access-label">Acceso privado</span><NotificationCenter/><CommandSearch role={user.role}/></div></header><main id="workspace-content" tabIndex={-1} className="workspace-content">{children}</main><footer className="workspace-footer"><span>Sistema AJ</span><span>Seguros, relaciones y seguimiento.</span></footer></div>
    <MobileNav groups={groups} user={{ ...user, roleLabel: roles[user.role] }}/>
    </AccountPanelsProvider></TourProvider></UploadProvider></ConfirmProvider></ToastProvider><TooltipLayer/><div id="workspace-portal" className="workspace-portal"/>
  </div>;
}
