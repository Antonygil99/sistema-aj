'use client';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Category, DocumentText, MagicStar, More, NotificationBing, UserOctagon, type Icon } from '@/components/icons';
import { GoogleCalendarBrandIcon, WhatsAppBrandIcon } from './brand-icons';
import { moduleIcons } from './module-icons';
import { portalTarget } from './ui/modal';
import { hasRole, type AccessRole } from '@/lib/access-policy';

type Destination = { href: string; label: string; icon: Icon; minimum?: AccessRole };
const primary: Destination[] = [
  { href: '/', label: 'Resumen', icon: Category },
  { href: '/whatsapp', label: 'WhatsApp', icon: WhatsAppBrandIcon },
  { href: '/agenda', label: 'Mi agenda', icon: GoogleCalendarBrandIcon },
  { href: '/crm/prospectos', label: 'Prospectos', icon: moduleIcons.prospectos },
  { href: '/crm/clientes', label: 'Clientes', icon: moduleIcons.clientes },
  { href: '/crm/polizas', label: 'Pólizas', icon: moduleIcons.polizas },
  { href: '/crm/pagos', label: 'Pagos', icon: moduleIcons.pagos },
  { href: '/crm/documentos', label: 'Documentos', icon: moduleIcons.documentos },
];
const secondary: { label: string; items: Destination[] }[] = [
  { label: 'Seguimiento', items: [
    { href: '/crm/cotizaciones', label: 'Cotizaciones', icon: moduleIcons.cotizaciones },
    { href: '/crm/entregas', label: 'Entregas', icon: moduleIcons.entregas },
    { href: '/crm/renovaciones', label: 'Renovaciones', icon: moduleIcons.renovaciones },
    { href: '/crm/siniestros', label: 'Siniestros', icon: moduleIcons.siniestros },
    { href: '/crm/actividades', label: 'Actividades', icon: moduleIcons.actividades },
    { href: '/tramites', label: 'Trámites', icon: DocumentText, minimum: 'ADMIN' },
    { href: '/avisos', label: 'Avisos a clientes', icon: NotificationBing },
  ] },
  { label: 'Herramientas', items: [
    { href: '/crm/productos', label: 'Productos', icon: moduleIcons.productos },
    { href: '/asistentes', label: 'Asistentes', icon: MagicStar, minimum: 'SUPERADMIN' },
    { href: '/conexiones', label: 'Conexiones', icon: MagicStar },
    { href: '/novedades', label: 'Novedades', icon: MagicStar },
  ] },
  { label: 'Administración', items: [
    { href: '/usuarios', label: 'Usuarios y accesos', icon: UserOctagon, minimum: 'SUPERADMIN' },
    { href: '/logs', label: 'Registro de actividad', icon: DocumentText, minimum: 'SUPERADMIN' },
  ] },
];
// Rendered with pathname as its key: navigation always closes the flyout, including browser back/forward.
export function WorkspaceNavigation({ role }: { role: AccessRole }) {
  const pathname = usePathname();
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null), panel = useRef<HTMLDivElement>(null);
  const id = useId(), open = place !== null;
  const active = (href: string) => href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');
  const groups = secondary.map(group => ({ ...group, items: group.items.filter(item => !item.minimum || hasRole(role, item.minimum)) })).filter(group => group.items.length);
  const current = groups.flatMap(group => group.items).find(item => active(item.href));
  function show() {
    const rect = trigger.current!.getBoundingClientRect();
    const height = Math.min(560, window.innerHeight - 24);
    setPlace({ left: Math.min(rect.right + 10, window.innerWidth - 292), top: Math.max(12, Math.min(rect.top - 80, window.innerHeight - height - 12)) });
  }
  useEffect(() => {
    if (!open) return;
    (panel.current?.querySelector<HTMLElement>('a[aria-current="page"]') ?? panel.current?.querySelector<HTMLElement>('a'))?.focus();
    const outside = (target: EventTarget | null) => !(target instanceof Node && (panel.current?.contains(target) || trigger.current?.contains(target)));
    const onPointer = (event: PointerEvent) => { if (outside(event.target)) setPlace(null); };
    const onFocus = (event: FocusEvent) => { if (outside(event.target)) setPlace(null); };
    const onKey = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); setPlace(null); trigger.current?.focus(); } };
    const onResize = () => setPlace(null);
    const onScroll = (event: Event) => { if (!(event.target instanceof Node && panel.current?.contains(event.target))) setPlace(null); };
    document.addEventListener('pointerdown', onPointer); document.addEventListener('focusin', onFocus); document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize); window.addEventListener('scroll', onScroll, true);
    return () => { document.removeEventListener('pointerdown', onPointer); document.removeEventListener('focusin', onFocus); document.removeEventListener('keydown', onKey); window.removeEventListener('resize', onResize); window.removeEventListener('scroll', onScroll, true); };
  }, [open]);
  function navigateKeys(event: KeyboardEvent) {
    const links = Array.from(panel.current?.querySelectorAll<HTMLAnchorElement>('a') ?? []);
    const index = links.indexOf(document.activeElement as HTMLAnchorElement);
    const target = event.key === 'ArrowDown' ? (index + 1) % links.length : event.key === 'ArrowUp' ? (index - 1 + links.length) % links.length : event.key === 'Home' ? 0 : event.key === 'End' ? links.length - 1 : null;
    if (target !== null) { event.preventDefault(); links[target]?.focus(); }
  }
  return <>
    <nav aria-label="Navegación principal" className="workspace-nav">
      <div className="nav-group nav-essential">{primary.map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-current={active(href) ? 'page' : undefined} aria-label={label} data-tooltip={label}><Icon aria-hidden="true"/><span className="sidebar-label">{label}</span></Link>)}</div>
      <div className="nav-group nav-more"><button ref={trigger} type="button" className={`sidebar-more-trigger${current ? ' is-active' : ''}`} aria-label={current ? `Más opciones · sección actual: ${current.label}` : 'Más opciones'} aria-expanded={open} aria-controls={open ? id : undefined} data-tooltip={current ? `Más · ${current.label}` : 'Más opciones'} onClick={() => open ? setPlace(null) : show()} onKeyDown={event => { if (event.key === 'ArrowDown' && !open) { event.preventDefault(); show(); } }}><More aria-hidden="true"/><span className="sidebar-label">Más</span>{current ? <span className="sidebar-more-dot" aria-hidden="true"/> : null}</button></div>
    </nav>
    {place && portalTarget() ? createPortal(<div ref={panel} id={id} className="sidebar-more-panel" style={place} onKeyDown={navigateKeys}><nav aria-label="Más secciones">{groups.map(group => <div className="sidebar-more-group" key={group.label}><p>{group.label}</p>{group.items.map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-current={active(href) ? 'page' : undefined} onClick={() => setPlace(null)}><Icon aria-hidden="true"/><span>{label}</span></Link>)}</div>)}</nav></div>, portalTarget()!) : null}
  </>;
}
