'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Category, Element3, FolderOpen, People, UserAdd, UserOctagon } from 'iconsax-reactjs';
import { modules, type ModuleSlug } from '@/modules/catalog';
import { moduleIcons } from '../module-icons';
import { SignOutButton } from '../sign-out-button';
import { Modal } from './modal';
const primary = [
  { href: '/', label: 'Resumen', icon: Category },
  { href: '/crm/clientes', label: 'Clientes', icon: People },
  { href: '/crm/prospectos', label: 'Prospectos', icon: UserAdd },
  { href: '/crm/documentos', label: 'Archivos', icon: FolderOpen },
];
// Phone-only tab bar (≤760 px): four destinations within thumb reach, everything else in a swipeable sheet.
export function MobileNav({ groups, user }: { groups: { label: string; slugs: ModuleSlug[] }[]; user: { name: string; role: string; roleLabel: string } }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');
  const inPrimary = primary.some(item => isActive(item.href));
  return <>
    <nav className="mobile-tabbar" aria-label="Navegación móvil">
      {primary.map(item => { const Icon = item.icon; const active = isActive(item.href); return <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={active ? 'is-active' : ''}><Icon variant={active ? 'Bold' : 'Linear'} aria-hidden="true"/><span>{item.label}</span></Link>; })}
      <button type="button" className={!inPrimary ? 'is-active' : ''} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}><Element3 variant={!inPrimary ? 'Bold' : 'Linear'} aria-hidden="true"/><span>Más</span></button>
    </nav>
    <Modal open={open} onClose={() => setOpen(false)} title="Todo tu espacio" description={`${user.name} · ${user.roleLabel}`} size="sm" className="mobile-menu">
      {groups.map(group => <section key={group.label} className="mobile-menu-group"><p className="mobile-menu-label">{group.label}</p><div className="mobile-menu-grid">{group.slugs.map(slug => { const item = modules.find(module => module.slug === slug)!; const Icon = moduleIcons[slug]; return <Link key={slug} href={`/crm/${slug}`} onClick={() => setOpen(false)} aria-current={isActive(`/crm/${slug}`) ? 'page' : undefined}><Icon aria-hidden="true"/><span>{item.label}</span></Link>; })}</div></section>)}
      {user.role === 'SUPERADMIN' ? <section className="mobile-menu-group"><p className="mobile-menu-label">Administración</p><div className="mobile-menu-grid"><Link href="/usuarios" onClick={() => setOpen(false)}><UserOctagon aria-hidden="true"/><span>Usuarios y accesos</span></Link></div></section> : null}
      <div className="mobile-menu-account"><SignOutButton/></div>
    </Modal>
  </>;
}
