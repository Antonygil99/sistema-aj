'use client';
import { useCallback, useEffect, useId, useRef, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Notification, Card, ClipboardTick, Refresh2, Setting2, TickCircle } from '@/components/icons';
import { describeEvent, eventHref, feedView, type NotificationEvent, type Reminders } from '@/modules/notifications';
import { apiFetch, ApiError } from './client-api';
import { portalTarget } from './modal';
import { usePreferences } from './preferences';
import { useAccountPanels } from './account-panels';
import { useToast } from './toast';
type Feed = { cursor: string; events: (NotificationEvent & { own: boolean })[]; recent: (NotificationEvent & { own: boolean })[]; reminders: Reminders };
const POLL_MS = 20000;
const SEEN_KEY = 'aj:notifications-seen';
const readSeen = () => { try { return localStorage.getItem(SEEN_KEY) ?? ''; } catch { return ''; } };
const writeSeen = (value: string) => { try { localStorage.setItem(SEEN_KEY, value); } catch { /* private mode */ } };
// Reminders are daily: a cleared set comes back the next calendar day in Mexico City.
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
export function relativeTime(iso: string, now = Date.now()) {
  const minutes = Math.round((now - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'Ahora';
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(iso));
}
type Place = { top: number; right?: number; left?: number };
// Light polling (every 20 s while the tab is visible): no extra service, a few seconds of delay at most.
// The panel drops down from the bell (full width under the top bar on phones) and follows the user's preferences.
export function NotificationCenter() {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [place, setPlace] = useState<Place | null>(null);
  // Only read once the feed arrives, so the server render and the first client render match.
  const [seen, setSeen] = useState(() => typeof window === 'undefined' ? '' : readSeen());
  const cursor = useRef<string | null>(null);
  const stopped = useRef(false);
  const bell = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const focusFirst = useRef(false);
  const panelId = useId();
  const toast = useToast();
  const { preferences, update } = usePreferences();
  const { openSettings } = useAccountPanels();
  const settings = preferences.notifications;
  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  const open = place !== null;
  const close = useCallback((returnFocus = false) => { setPlace(null); if (returnFocus) bell.current?.focus(); }, []);
  const poll = useCallback(async () => {
    if (stopped.current || document.visibilityState !== 'visible') return;
    try {
      const data = await apiFetch<Feed>('/api/notifications' + (cursor.current ? `?since=${encodeURIComponent(cursor.current)}` : ''));
      cursor.current = data.cursor;
      setFeed(data);
      const { team, toasts } = settingsRef.current;
      if (team && toasts) {
        if (data.events.length > 3) toast({ kind: 'info', title: `${data.events.length} novedades del equipo`, message: 'Abre las notificaciones para ver el detalle.' });
        else for (const event of data.events) { const href = eventHref(event); toast({ kind: 'info', title: 'Novedad del equipo', message: describeEvent(event), action: href ? { label: 'Ver', href } : undefined }); }
      }
      // Open screens refresh themselves when a teammate changes something they show (whatever the preferences).
      for (const changed of new Set(data.events.map(event => event.module))) window.dispatchEvent(new CustomEvent('aj:remote-change', { detail: { module: changed } }));
      if (data.events.some(event => event.module === 'documentos' || event.module === 'carpetas')) window.dispatchEvent(new CustomEvent('aj:documents-changed', { detail: { remote: true } }));
    } catch (error) { if (error instanceof ApiError && (error.status === 401 || error.status === 403)) stopped.current = true; }
  }, [toast]);
  useEffect(() => {
    void poll();
    const timer = setInterval(() => void poll(), POLL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') void poll(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [poll]);
  useEffect(() => {
    if (!open) return;
    if (focusFirst.current) panel.current?.querySelector<HTMLElement>('a, button:not([disabled])')?.focus();
    const outside = (target: EventTarget | null) => !(target instanceof Node && (panel.current?.contains(target) || bell.current?.contains(target)));
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close(true); };
    const onPointer = (event: PointerEvent) => { if (outside(event.target)) close(); };
    const onFocus = (event: FocusEvent) => { if (outside(event.target)) close(); };
    const onResize = () => close();
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('focusin', onFocus);
    window.addEventListener('resize', onResize);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onPointer); document.removeEventListener('focusin', onFocus); window.removeEventListener('resize', onResize); };
  }, [open, close]);
  const view = feed ? feedView(feed, settings, today()) : null;
  const others = view?.events.filter(event => !event.own) ?? [];
  const unread = others.filter(event => event.createdAt > seen).length + (view?.showReminders ? 1 : 0);
  const canClear = Boolean(view && (view.events.length || view.showReminders));
  function toggle(event: MouseEvent) {
    if (open) { close(); return; }
    const rect = bell.current!.getBoundingClientRect();
    // Keyboard activation (Enter/Space) reports no clicks: then move focus into the panel.
    focusFirst.current = event.detail === 0;
    setPlace(window.innerWidth <= 760 ? { top: rect.bottom + 8, left: 12, right: 12 } : { top: rect.bottom + 10, right: Math.max(12, window.innerWidth - rect.right - 6) });
    const latest = feed?.recent[0]?.createdAt;
    if (latest) { setSeen(latest); writeSeen(latest); }
  }
  function clear() {
    if (!feed || !view) return;
    const previous = { clearedAt: settings.clearedAt, clearedReminders: settings.clearedReminders };
    update({ notifications: { clearedAt: feed.cursor, clearedReminders: view.reminderKey } });
    toast({ kind: 'success', title: 'Notificaciones limpiadas', message: 'Las novedades nuevas seguirán apareciendo aquí.', action: { label: 'Deshacer', onClick: () => update({ notifications: previous }) } });
  }
  const target = portalTarget();
  const reminders = view?.reminders;
  return <>
    <button ref={bell} type="button" className="notification-bell" aria-label={unread ? `Notificaciones, ${unread} sin leer` : 'Notificaciones'} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? panelId : undefined} onClick={toggle}><Notification aria-hidden="true"/>{unread ? <span className="notification-count" aria-hidden="true">{unread > 9 ? '9+' : unread}</span> : null}</button>
    {place && target ? createPortal(<div ref={panel} id={panelId} role="dialog" aria-label="Notificaciones" className="notification-dropdown" style={place}>
      <div className="notification-head">
        <strong>Notificaciones</strong>
        <button type="button" className="text-button" disabled={!canClear} onClick={clear}>Limpiar</button>
        <button type="button" className="icon-button" aria-label="Preferencias de notificaciones" onClick={() => { close(); openSettings('notificaciones'); }}><Setting2 aria-hidden="true"/></button>
      </div>
      <div className="notification-body">
        {view?.showReminders && reminders ? <div className="reminder-list">
          {reminders.followUpsDue ? <Link href="/crm/entregas?owner=me" onClick={() => close()} className="reminder tone-green"><ClipboardTick aria-hidden="true"/><span><strong>{reminders.followUpsDue} seguimiento{reminders.followUpsDue === 1 ? '' : 's'} para hoy</strong><small>Entrega activa: revisa cómo usan su póliza</small></span></Link> : null}
          {reminders.overduePayments ? <Link href="/crm/pagos" onClick={() => close()} className="reminder tone-red"><Card aria-hidden="true"/><span><strong>{reminders.overduePayments} recibo{reminders.overduePayments === 1 ? '' : 's'} vencido{reminders.overduePayments === 1 ? '' : 's'}</strong><small>Pendientes de cobro con fecha pasada</small></span></Link> : null}
          {reminders.renewalsThisWeek ? <Link href="/crm/renovaciones" onClick={() => close()} className="reminder tone-sand"><Refresh2 aria-hidden="true"/><span><strong>{reminders.renewalsThisWeek} renovación{reminders.renewalsThisWeek === 1 ? '' : 'es'} esta semana</strong><small>Próximos 7 días</small></span></Link> : null}
        </div> : null}
        {view?.events.length ? <ol className="event-list">{view.events.map(event => { const href = eventHref(event); const content = <><span className={`event-dot${event.own ? ' is-own' : ''}`} aria-hidden="true"/><span><span className="event-text">{describeEvent(event, event.own)}</span><small>{relativeTime(event.createdAt)}</small></span></>; return <li key={event.id}>{href ? <Link href={href} onClick={() => close()}>{content}</Link> : <div>{content}</div>}</li>; })}</ol>
          : !view?.showReminders ? <div className="notification-empty"><TickCircle aria-hidden="true"/><strong>Estás al día</strong><p>{settings.team ? 'Aquí verás lo que tu equipo registra, edita o sube, y tus recordatorios.' : 'La actividad del equipo está desactivada en tus preferencias.'}</p></div> : null}
      </div>
    </div>, target) : null}
  </>;
}
