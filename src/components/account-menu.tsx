'use client';
import { useEffect, useId, useRef, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { ArrowRight2, Chart, MessageQuestion, Moon, Note, Setting2, UserOctagon } from '@/components/icons';
import {GoogleCalendarBrandIcon} from './brand-icons';
import { Avatar } from './ui/avatar';
import { SignOutButton } from './sign-out-button';
import { useAccountPanels } from './ui/account-panels';
import { portalTarget } from './ui/modal';
export type AccountUser = { name: string; email: string; image: string | null; role: 'USER' | 'ADMIN' | 'SUPERADMIN' };
// Sidebar account row (photo, name, email). Opens a small menu beside the sidebar with the role and account actions.
// The menu is position: fixed and portaled out of the sticky sidebar (its own stacking context), so neither the
// sidebar scroll nor positioned page content can cover it, also in compact mode.
export function AccountMenu({ user, roleLabel }: { user: AccountUser; roleLabel: string }) {
  const [place, setPlace] = useState<{ left: number; bottom: number } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const focusFirst = useRef(false);
  const { openHelp, openSettings, darkActive, toggleDark } = useAccountPanels();
  const open = place !== null;
  function toggle(event: MouseEvent) {
    if (open) { setPlace(null); return; }
    // Keyboard activation (Enter/Space) reports no clicks: then move focus into the menu.
    focusFirst.current = event.detail === 0;
    const rect = trigger.current!.getBoundingClientRect();
    setPlace({ left: rect.right + 10, bottom: Math.max(8, window.innerHeight - rect.bottom) });
  }
  useEffect(() => {
    if (!open) return;
    if (focusFirst.current) panel.current?.querySelector<HTMLElement>('a, button')?.focus();
    const outside = (target: EventTarget | null) => !(target instanceof Node && (panel.current?.contains(target) || trigger.current?.contains(target)));
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { setPlace(null); trigger.current?.focus(); } };
    const onPointer = (event: PointerEvent) => { if (outside(event.target)) setPlace(null); };
    const onFocus = (event: FocusEvent) => { if (outside(event.target)) setPlace(null); };
    const onResize = () => setPlace(null);
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('focusin', onFocus);
    window.addEventListener('resize', onResize);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onPointer); document.removeEventListener('focusin', onFocus); window.removeEventListener('resize', onResize); };
  }, [open]);
  return <>
    <button ref={trigger} type="button" className="account-trigger" aria-expanded={open} aria-controls={open ? menuId : undefined} aria-label={`Tu cuenta: ${user.name}`} data-tooltip={user.name} onClick={toggle}>
      <Avatar name={user.name} email={user.email} image={user.image} size={34}/>
      <span className="sidebar-label account-name"><strong>{user.name}</strong><small>{user.email}</small></span>
      <ArrowRight2 className="sidebar-label account-chevron" aria-hidden="true"/>
    </button>
    {place && portalTarget() ? createPortal(<div ref={panel} id={menuId} className="account-menu" style={{ left: place.left, bottom: place.bottom }}>
      <div className="account-menu-header">
        <Avatar name={user.name} email={user.email} image={user.image} size={40}/>
        <div className="account-menu-identity"><strong>{user.name}</strong><span>{user.email}</span><small className="account-role">{roleLabel}</small></div>
      </div>
      <button type="button" className="account-menu-item" onClick={() => { setPlace(null); openHelp(); }}><MessageQuestion aria-hidden="true"/>Centro de ayuda</button>
      <Link className="account-menu-item" href="/novedades" onClick={() => setPlace(null)}><Note aria-hidden="true"/>Novedades y mejoras</Link>
      <Link className="account-menu-item" href="/agenda" onClick={() => setPlace(null)}><GoogleCalendarBrandIcon aria-hidden="true"/>Mi agenda y Google Calendar</Link><button type="button" className="account-menu-item" onClick={() => { setPlace(null); openSettings(); }}><Setting2 aria-hidden="true"/>Preferencias</button>
      <button type="button" className="account-menu-item" disabled aria-describedby={`${menuId}-soon`}><Chart aria-hidden="true"/>Reportes<span className="soon-pill" id={`${menuId}-soon`}>Próximamente</span></button>
      {user.role === 'SUPERADMIN' ? <Link className="account-menu-item" href="/usuarios" onClick={() => setPlace(null)}><UserOctagon aria-hidden="true"/>Usuarios y accesos</Link> : null}
      <div className="account-menu-divider" role="separator"/>
      {/* Quick switch; the full choice (including "según el dispositivo") lives in Preferencias. */}
      <button type="button" role="switch" aria-checked={darkActive()} className="account-menu-item" onClick={toggleDark}><Moon aria-hidden="true"/>Modo oscuro<span className="switch is-small" aria-hidden="true"><span/></span></button>
      <SignOutButton className="account-menu-item"/>
    </div>, portalTarget()!) : null}
  </>;
}
