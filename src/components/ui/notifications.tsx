'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Notification, Card, ClipboardTick, Refresh2 } from 'iconsax-reactjs';
import { describeEvent, eventHref, type NotificationEvent } from '@/modules/notifications';
import { apiFetch, ApiError } from './client-api';
import { Modal } from './modal';
import { useToast } from './toast';
type Feed = { cursor: string; events: (NotificationEvent & { own: boolean })[]; recent: (NotificationEvent & { own: boolean })[]; reminders: { overduePayments: number; renewalsThisWeek: number; followUpsDue: number } };
const POLL_MS = 20000;
const SEEN_KEY = 'aj:notifications-seen';
const readSeen = () => { try { return localStorage.getItem(SEEN_KEY) ?? ''; } catch { return ''; } };
const writeSeen = (value: string) => { try { localStorage.setItem(SEEN_KEY, value); } catch { /* private mode */ } };
export function relativeTime(iso: string, now = Date.now()) {
  const minutes = Math.round((now - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'Ahora';
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(iso));
}
// Light polling (every 20 s while the tab is visible): no extra service, a few seconds of delay at most.
export function NotificationCenter() {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [open, setOpen] = useState(false);
  // Only read once the feed arrives, so the server render and the first client render match.
  const [seen, setSeen] = useState(() => typeof window === 'undefined' ? '' : readSeen());
  const cursor = useRef<string | null>(null);
  const stopped = useRef(false);
  const toast = useToast();
  const poll = useCallback(async () => {
    if (stopped.current || document.visibilityState !== 'visible') return;
    try {
      const data = await apiFetch<Feed>('/api/notifications' + (cursor.current ? `?since=${encodeURIComponent(cursor.current)}` : ''));
      cursor.current = data.cursor;
      setFeed(data);
      if (data.events.length > 3) toast({ kind: 'info', title: `${data.events.length} novedades del equipo`, message: 'Abre las notificaciones para ver el detalle.', action: { label: 'Ver', onClick: () => setOpen(true) } });
      else for (const event of data.events) { const href = eventHref(event); toast({ kind: 'info', title: 'Novedad del equipo', message: describeEvent(event), action: href ? { label: 'Ver', href } : undefined }); }
      // Let open screens refresh themselves when a teammate changes something they show.
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
  const others = feed?.recent.filter(event => !event.own) ?? [];
  const reminders = feed ? feed.reminders.overduePayments + feed.reminders.renewalsThisWeek + feed.reminders.followUpsDue : 0;
  const unread = others.filter(event => event.createdAt > seen).length + (reminders ? 1 : 0);
  function openPanel() {
    setOpen(true);
    const latest = feed?.recent[0]?.createdAt;
    if (latest) { setSeen(latest); writeSeen(latest); }
  }
  return <>
    <button type="button" className="notification-bell" aria-label={unread ? `Notificaciones, ${unread} sin leer` : 'Notificaciones'} onClick={openPanel}><Notification aria-hidden="true"/>{unread ? <span className="notification-count" aria-hidden="true">{unread > 9 ? '9+' : unread}</span> : null}</button>
    <Modal open={open} onClose={() => setOpen(false)} title="Notificaciones" description="Actividad reciente del equipo y recordatorios." size="sm" className="notification-panel">
      {feed && reminders ? <div className="reminder-list">
        {feed.reminders.followUpsDue ? <Link href="/crm/entregas?owner=me" onClick={() => setOpen(false)} className="reminder tone-green"><ClipboardTick aria-hidden="true"/><span><strong>{feed.reminders.followUpsDue} seguimiento{feed.reminders.followUpsDue === 1 ? '' : 's'} para hoy</strong><small>Entrega activa: revisa cómo usan su póliza</small></span></Link> : null}
        {feed.reminders.overduePayments ? <Link href="/crm/pagos" onClick={() => setOpen(false)} className="reminder tone-red"><Card aria-hidden="true"/><span><strong>{feed.reminders.overduePayments} recibo{feed.reminders.overduePayments === 1 ? '' : 's'} vencido{feed.reminders.overduePayments === 1 ? '' : 's'}</strong><small>Pendientes de cobro con fecha pasada</small></span></Link> : null}
        {feed.reminders.renewalsThisWeek ? <Link href="/crm/renovaciones" onClick={() => setOpen(false)} className="reminder tone-sand"><Refresh2 aria-hidden="true"/><span><strong>{feed.reminders.renewalsThisWeek} renovación{feed.reminders.renewalsThisWeek === 1 ? '' : 'es'} esta semana</strong><small>Próximos 7 días</small></span></Link> : null}
      </div> : null}
      {feed?.recent.length ? <ol className="event-list">{feed.recent.map(event => { const href = eventHref(event); const content = <><span className={`event-dot${event.own ? ' is-own' : ''}`} aria-hidden="true"/><span><span className="event-text">{describeEvent(event, event.own)}</span><small>{relativeTime(event.createdAt)}</small></span></>; return <li key={event.id}>{href ? <Link href={href} onClick={() => setOpen(false)}>{content}</Link> : <div>{content}</div>}</li>; })}</ol>
        : <p className="lead-small">Todavía no hay actividad registrada. Aquí verás lo que tu equipo crea, edita o sube.</p>}
    </Modal>
  </>;
}
