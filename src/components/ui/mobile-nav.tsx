'use client';
import { GoogleCalendarBrandIcon, WhatsAppBrandIcon } from '@/components/brand-icons';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Category, Chart, DocumentText, Element3, FolderOpen, MagicStar, MessageQuestion, Moon, NotificationBing, People, Setting2, UserAdd, UserOctagon } from '@/components/icons';
import { modules, type ModuleSlug } from '@/modules/catalog';
import { moduleIcons } from '../module-icons';
import { SignOutButton } from '../sign-out-button';
import { Avatar } from './avatar';
import { useAccountPanels } from './account-panels';
import { Modal } from './modal';
const primary = [
  { href: '/', label: 'Resumen', icon: Category },
  { href: '/crm/clientes', label: 'Clientes', icon: People },
  { href: '/crm/prospectos', label: 'Prospectos', icon: UserAdd },
  { href: '/crm/documentos', label: 'Archivos', icon: FolderOpen },
];
// Phone-only tab bar (≤760 px): four destinations within thumb reach, everything else in a swipeable sheet.
export function MobileNav({ groups, user }: { groups: { label: string; slugs: ModuleSlug[] }[]; user: { name: string; email: string; image: string | null; role: string; roleLabel: string } }) {
  const pathname = usePathname();
  const { openHelp, openSettings, darkActive, toggleDark } = useAccountPanels();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');
  const inPrimary = primary.some(item => isActive(item.href));
  return <>
    <nav className="mobile-tabbar" aria-label="Navegación móvil">
      {primary.map(item => { const Icon = item.icon; const active = isActive(item.href); return <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={active ? 'is-active' : ''}><Icon variant={active ? 'Bold' : 'Linear'} aria-hidden="true"/><span>{item.label}</span></Link>; })}
      <button type="button" className={!inPrimary ? 'is-active' : ''} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}><Element3 variant={!inPrimary ? 'Bold' : 'Linear'} aria-hidden="true"/><span>Más</span></button>
    </nav>
    <Modal open={open} onClose={() => setOpen(false)} title="Todo tu espacio" description="Módulos, accesos y tu cuenta" size="sm" className="mobile-menu">
      {groups.map(group => <section key={group.label} className="mobile-menu-group"><p className="mobile-menu-label">{group.label}</p><div className="mobile-menu-grid">{group.slugs.map(slug => { const item = modules.find(module => module.slug === slug)!; const Icon = moduleIcons[slug]; return <Link key={slug} href={`/crm/${slug}`} onClick={() => setOpen(false)} aria-current={isActive(`/crm/${slug}`) ? 'page' : undefined}><Icon aria-hidden="true"/><span>{item.label}</span></Link>; })}</div></section>)}
      {user.role === 'SUPERADMIN' ? <section className="mobile-menu-group"><p className="mobile-menu-label">Administración</p><div className="mobile-menu-grid"><Link href="/usuarios" onClick={() => setOpen(false)}><UserOctagon aria-hidden="true"/><span>Usuarios y accesos</span></Link><Link href="/logs" onClick={() => setOpen(false)} aria-current={isActive('/logs') ? 'page' : undefined}><DocumentText aria-hidden="true"/><span>Registro de actividad</span></Link></div></section> : null}
      <section className="mobile-menu-group"><p className="mobile-menu-label">Mi día</p><div className="mobile-menu-grid">{user.role!=='USER'?<Link href="/tramites" onClick={()=>setOpen(false)} aria-current={isActive('/tramites')?'page':undefined}><DocumentText aria-hidden="true"/><span>Trámites</span></Link>:null}<Link href="/agenda" onClick={() => setOpen(false)} aria-current={isActive('/agenda') ? 'page' : undefined}><GoogleCalendarBrandIcon/><span>Google Calendar</span></Link><Link href="/avisos" onClick={() => setOpen(false)} aria-current={isActive('/avisos') ? 'page' : undefined}><NotificationBing aria-hidden="true"/><span>Avisos a clientes</span></Link><Link href="/whatsapp" onClick={() => setOpen(false)} aria-current={isActive('/whatsapp') ? 'page' : undefined}><WhatsAppBrandIcon aria-hidden="true"/><span>WhatsApp</span></Link>{user.role === 'SUPERADMIN' ? <Link href="/asistentes" onClick={() => setOpen(false)} aria-current={isActive('/asistentes') ? 'page' : undefined}><MagicStar aria-hidden="true"/><span>Asistentes</span></Link> : null}</div></section><section className="mobile-menu-group"><p className="mobile-menu-label">Ayuda y cuenta</p><div className="mobile-menu-grid"><Link href="/novedades" onClick={() => setOpen(false)} aria-current={isActive('/novedades') ? 'page' : undefined}><MagicStar aria-hidden="true"/><span>Novedades</span></Link><button type="button" onClick={() => { setOpen(false); window.setTimeout(openHelp, 280); }}><MessageQuestion aria-hidden="true"/><span>Centro de ayuda</span></button><button type="button" onClick={() => { setOpen(false); window.setTimeout(() => openSettings(), 280); }}><Setting2 aria-hidden="true"/><span>Preferencias</span></button><button type="button" disabled><Chart aria-hidden="true"/><span>Reportes</span><small className="soon-pill">Próximamente</small></button></div></section>
      <button type="button" role="switch" aria-checked={darkActive()} className="mobile-theme-row" onClick={toggleDark}><Moon aria-hidden="true"/><span>Modo oscuro</span><span className="switch" aria-hidden="true"><span/></span></button>
      <div className="mobile-menu-account"><Avatar name={user.name} email={user.email} image={user.image} size={40}/><span className="mobile-account-text"><strong>{user.name}</strong><small>{user.roleLabel}</small></span><SignOutButton/></div>
    </Modal>
  </>;
}
