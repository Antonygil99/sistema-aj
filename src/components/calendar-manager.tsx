'use client';
import {Select} from '@/components/ui/select';

import { useRef, useState, type FormEvent } from 'react';
import { Add, Refresh2 } from '@/components/icons';
import Image from 'next/image';
import { ApiError, apiFetch } from './ui/client-api';
import { useToast } from './ui/toast';
import { useConfirm } from './ui/confirm';
import { Modal } from './ui/modal';
import { calendarInputToIso, localCalendarInput, type CalendarEntry, type CalendarOverview, type MeetingInput } from '@/modules/calendar/types';

const formatDate = new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City', dateStyle: 'medium', timeStyle: 'short' });
type Draft = { title: string; description: string; location: string; start: string; end: string; attendees: string; reminder: string; reminderMethod: 'popup' | 'email'; googleMeet: boolean; notifyGuests: boolean; activityId: string };
function newDraft(activity?: CalendarOverview['activities'][number]): Draft {
  const start = activity?.dueDate ? `${activity.dueDate.slice(0, 10)}T09:00` : localCalendarInput(new Date(Date.now() + 3600000).toISOString());
  return { title: activity?.title ?? '', description: '', location: '', start, end: localCalendarInput(new Date(new Date(calendarInputToIso(start)).getTime() + 30 * 60000).toISOString()), attendees: '', reminder: '30', reminderMethod: 'popup', googleMeet: false, notifyGuests: false, activityId: activity?.id ?? '' };
}
export function CalendarManager({ initial, connectionResult }: { initial: CalendarOverview; connectionResult?: string }) {
  const [data, setData] = useState(initial);
  const [view, setView] = useState<'upcoming' | 'history'>('upcoming');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');
  // Preserve the submitted request on network failures. Retries use exactly the same payload and event ID.
  const submission = useRef<MeetingInput | null>(null);
  const initialDraft = useRef<Draft | null>(null);
  const toast = useToast(), confirm = useConfirm();
  function fail(error: unknown) { const message = error instanceof Error ? error.message : 'No se pudo completar la acción.'; setError(message); toast({ kind: 'error', title: 'Revisa tu agenda', message }); }
  async function reload(nextView = view) {
    const result = await apiFetch<{ data: CalendarOverview }>(`/api/calendar?view=${nextView}`);
    setData(result.data); setView(nextView);
  }
  async function action(task: () => Promise<void>) {
    setBusy(true); setError('');
    try { await task(); } catch (error) { fail(error); } finally { setBusy(false); }
  }
  async function connect() {
    await action(async () => {
      const result = await apiFetch<{ url: string }>('/api/calendar/connect', { method: 'POST' });
      const url = new URL(result.url);
      if (url.protocol !== 'https:' || url.hostname !== 'accounts.google.com') throw new Error('No se pudo abrir la autorización de Google.');
      window.location.assign(url.toString());
    });
  }
  async function disconnect() {
    if (!await confirm({ title: 'Desconectar Google Calendar', message: 'Sistema AJ dejará de acceder a tu calendario. Tus eventos seguirán en Google y podrás volver a conectar la misma cuenta.', confirmLabel: 'Desconectar' })) return;
    await action(async () => { await apiFetch('/api/calendar', { method: 'DELETE' }); setData(current => ({ ...current, connected: false })); toast({ kind: 'success', title: 'Calendario desconectado' }); });
  }
  function open(activity?: CalendarOverview['activities'][number]) { const next = newDraft(activity); initialDraft.current = next; setDraft(next); submission.current = null; setRetrying(false); setError(''); setEditing(true); }
  async function closeMeeting() {
    if (busy) return;
    if (!submission.current && draft && JSON.stringify(draft) !== JSON.stringify(initialDraft.current) && !await confirm({ title: 'Cerrar sin crear la reunión', message: 'Los datos de este formulario aún no se han guardado.', confirmLabel: 'Descartar borrador' })) return;
    setEditing(false); await action(() => reload());
  }
  function patch(values: Partial<Draft>) { if (!submission.current) setDraft(current => current ? { ...current, ...values } : null); }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    await action(async () => {
      const body = submission.current ?? {
        requestId: crypto.randomUUID(), title: draft.title.trim(), description: draft.description.trim(), location: draft.location.trim(),
        startAt: calendarInputToIso(draft.start), endAt: calendarInputToIso(draft.end), attendees: [...new Set(draft.attendees.split(/[\s,;]+/).filter(Boolean).map(email => email.toLowerCase()))],
        reminderMinutes: draft.reminder === '' ? null : Number(draft.reminder), reminderMethod: draft.reminderMethod, useDefaultReminders: false,
        googleMeet: draft.googleMeet, notifyGuests: draft.notifyGuests, ...(draft.activityId ? { activityId: draft.activityId } : {}),
      };
      if (!body.title) throw new Error('Escribe el título de la reunión.');
      const duration = new Date(body.endAt).getTime() - new Date(body.startAt).getTime();
      if (duration <= 0 || duration > 7 * 86400000) throw new Error('El final debe ser posterior al inicio y la reunión no puede durar más de siete días.');
      if (body.attendees.length > 20 || body.attendees.some(email => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new Error('Revisa los correos de los invitados; se permiten hasta 20.');
      submission.current = body; setRetrying(true);
      let result: { data: CalendarEntry };
      try { result = await apiFetch<{ data: CalendarEntry }>('/api/calendar/events', { method: 'POST', json: body, labels: { title: 'Título', startAt: 'Inicio', endAt: 'Final', attendees: 'Invitados' } }); }
      catch (error) {
        if (error instanceof ApiError && ['INVALID_INPUT', 'CALENDAR_EVENT_INVALID', 'CALENDAR_ACTIVITY_NOT_FOUND'].includes(error.code)) { submission.current = null; setRetrying(false); }
        throw error;
      }
      setData(current => ({ ...current, entries: [...current.entries.filter(entry => entry.id !== result.data.id), result.data].sort((a, b) => a.startAt.localeCompare(b.startAt)) }));
      setEditing(false); submission.current = null; setRetrying(false);
      toast({ kind: 'success', title: 'Reunión creada en Google Calendar', message: result.data.googleMeet && !result.data.meetUrl ? 'El enlace de Meet está en preparación. Usa «Actualizar desde Google» en unos segundos.' : undefined });
    });
  }
  async function cancel(entry: CalendarEntry) {
    if (!await confirm({ title: entry.status === 'FAILED' ? 'Descartar intento' : 'Cancelar reunión', message: entry.status === 'FAILED' ? `Google no creó «${entry.title}». Se quitará de tus pendientes.` : `Se eliminará «${entry.title}» de tu Google Calendar.${entry.notifyGuests && entry.attendees.length ? ' Google notificará la cancelación a los invitados.' : ''}`, confirmLabel: entry.status === 'FAILED' ? 'Descartar' : 'Cancelar reunión', tone: 'danger' })) return;
    await action(async () => { await apiFetch(`/api/calendar/events/${entry.id}`, { method: 'DELETE' }); await reload(); toast({ kind: 'success', title: 'Reunión cancelada' }); });
  }
  async function eventAction(entry: CalendarEntry, task: 'retry' | 'refresh') {
    await action(async () => { await apiFetch(`/api/calendar/events/${entry.id}`, { method: 'POST', json: { action: task } }); await reload(); });
  }
  return <>
    <section className="document-panel calendar-connection" aria-label="Conexión con Google Calendar"><Image className="calendar-connection-logo" src="/brands/google-calendar.svg" width={36} height={36} alt="Google Calendar"/><div><h2>{data.connected ? 'Google Calendar conectado' : 'Conecta tu Google Calendar'}</h2><p>{data.email} · Calendario principal</p><p className="lead-small">Los eventos se guardan en tu cuenta. Aquí se muestran las reuniones creadas desde Sistema AJ.</p></div><div className="calendar-connection-actions">
      <button type="button" className="button" disabled={busy} onClick={() => void connect()}>{data.connected ? 'Renovar conexión' : 'Conectar Google Calendar'}</button>
      {data.connected ? <button type="button" className="text-button" disabled={busy} onClick={() => void disconnect()}>Desconectar</button> : null}
    </div></section>
    {connectionResult === 'connected' ? <p className="notice" role="status">Tu calendario quedó conectado. Ya puedes crear reuniones y recordatorios.</p> : null}
    {['denied', 'reconnect'].includes(connectionResult ?? '') ? <p className="notice" role="alert">La conexión no se completó. Vuelve a conectar y autoriza el permiso de Calendar con la misma cuenta con la que entras al CRM.</p> : null}
    {error && !editing ? <p className="notice" role="alert">{error}</p> : null}
    <div className="resource-toolbar"><span className="resource-count">Hora de Ciudad de México · Hasta 50 reuniones</span><button type="button" className="text-button" disabled={busy} onClick={() => void action(() => reload())}><Refresh2 aria-hidden="true"/>Actualizar</button><button type="button" className="button" disabled={busy || !data.connected} onClick={() => open()}><Add aria-hidden="true"/>Nueva reunión</button></div>
    <div className="resource-filters"><label>Mostrar<Select value={view} disabled={busy} onChange={event => void action(() => reload(event.target.value as typeof view))}><option value="upcoming">Próximas y pendientes</option><option value="history">Historial</option></Select></label></div>
    <div className="table-wrap"><table><caption className="sr-only">Reuniones de tu agenda</caption><thead><tr><th>Reunión</th><th>Horario (CDMX)</th><th>Recordatorio</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
      {data.entries.map(entry => <tr key={entry.id}><td><strong>{entry.title}</strong>{entry.location ? <><br/><small>{entry.location}</small></> : null}{entry.attendees.length ? <><br/><small>{entry.attendees.length} invitado{entry.attendees.length === 1 ? '' : 's'}</small></> : null}</td><td>{formatDate.format(new Date(entry.startAt))}<br/><small>Hasta {formatDate.format(new Date(entry.endAt))}</small></td><td>{entry.useDefaultReminders ? 'Seg?n tu Google Calendar' : entry.reminderMinutes === null ? 'Sin recordatorio' : `${entry.reminderMinutes} min antes · ${entry.reminderMethod === 'email' ? 'Correo' : 'Notificación'}`}</td><td>{({ FAILED: 'No se cre?', PENDING: 'Pendiente de crear', SYNCED: 'En Google Calendar', CANCEL_PENDING: 'Cancelación pendiente', CANCELLED: 'Cancelada' } as Record<string, string>)[entry.status] ?? entry.status}</td><td className="calendar-row-actions">
        {entry.status === 'SYNCED' && entry.googleUrl ? <a className="text-button" href={entry.googleUrl} target="_blank" rel="noopener noreferrer">Ver / editar en Google</a> : null}
        {entry.status === 'SYNCED' && entry.meetUrl ? <a className="text-button" href={entry.meetUrl} target="_blank" rel="noopener noreferrer">Entrar a Meet</a> : null}
        {data.connected && entry.status === 'SYNCED' ? <><button className="text-button" disabled={busy} onClick={() => void eventAction(entry, 'refresh')}>Actualizar desde Google</button><button className="text-button is-danger" disabled={busy} onClick={() => void cancel(entry)}>Cancelar</button></> : null}
        {data.connected && entry.status === 'FAILED' ? <button className="text-button" disabled={busy} onClick={() => void cancel(entry)}>Descartar intento</button> : null}
        {data.connected && entry.status === 'PENDING' ? <button className="text-button" disabled={busy} onClick={() => void eventAction(entry, 'retry')}>Reintentar creación</button> : null}
        {data.connected && entry.status === 'CANCEL_PENDING' ? <button className="text-button" disabled={busy} onClick={() => void cancel(entry)}>Reintentar cancelación</button> : null}
      </td></tr>)}
      {!data.entries.length ? <tr><td colSpan={5}>No hay reuniones en esta vista. Crea una reunión o convierte una actividad pendiente en una cita.</td></tr> : null}
    </tbody></table></div>
    <section className="document-panel"><h2>Mis actividades pendientes</h2><p className="lead-small">Agenda una cita o un recordatorio para una actividad asignada a ti. La actividad mantiene su estado en el CRM.</p><div className="calendar-activities">{data.activities.map(activity => <div key={activity.id}><span>{activity.title}{activity.dueDate ? <small> · {activity.dueDate.slice(0, 10)}</small> : null}</span><button className="text-button" disabled={busy || !data.connected} onClick={() => open(activity)}>Agendar</button></div>)}{!data.activities.length ? <p>No tienes actividades pendientes asignadas.</p> : null}</div></section>
    <Modal open={editing} onClose={() => void closeMeeting()} busy={busy} size="md" title="Nueva reunión o recordatorio" description="Se creará en tu calendario principal de Google. Las horas se capturan en Ciudad de México."
      footer={<><button className="text-button" type="button" disabled={busy} onClick={() => void closeMeeting()}>Cerrar</button><span className="modal-footer-spacer"/><button className="button" type="submit" form="calendar-meeting-form" disabled={busy}>{busy ? 'Guardando…' : retrying ? 'Reintentar' : draft?.notifyGuests && draft.attendees.trim() ? 'Crear y enviar invitaciones' : 'Crear en Google Calendar'}</button></>}>
      {draft ? <form id="calendar-meeting-form" className="resource-form" onSubmit={event => void save(event)}>
        <fieldset className="calendar-form-fields" disabled={busy || retrying}>
          <label className="form-field is-wide">Título<input required maxLength={200} value={draft.title} onChange={event => patch({ title: event.target.value })}/></label>
          <label className="form-field">Inicio<input required type="datetime-local" value={draft.start} onChange={event => patch({ start: event.target.value })}/></label>
          <label className="form-field">Final<input required type="datetime-local" min={draft.start} value={draft.end} onChange={event => patch({ end: event.target.value })}/></label>
          <label className="form-field is-wide">Descripción<textarea maxLength={5000} value={draft.description} onChange={event => patch({ description: event.target.value })}/></label>
          <label className="form-field is-wide">Ubicación<input maxLength={300} value={draft.location} onChange={event => patch({ location: event.target.value })}/></label>
          <label className="form-field">Recordatorio<Select value={draft.reminder} onChange={event => patch({ reminder: event.target.value })}><option value="">Sin recordatorio</option>{[0,5,15,30,60,1440].map(minutes => <option key={minutes} value={minutes}>{minutes === 0 ? 'Al comenzar' : minutes === 1440 ? 'Un día antes' : `${minutes} minutos antes`}</option>)}</Select></label>
          <label className="form-field">Aviso<Select value={draft.reminderMethod} onChange={event => patch({ reminderMethod: event.target.value as Draft['reminderMethod'] })}><option value="popup">Notificación de Calendar</option><option value="email">Correo de Google Calendar</option></Select></label>
          <label className="form-field is-wide">Invitados (máximo 20)<textarea value={draft.attendees} onChange={event => patch({ attendees: event.target.value })} placeholder="Correos separados por coma o salto de línea" maxLength={5000}/></label>
          <label className="calendar-check"><input type="checkbox" checked={draft.notifyGuests} onChange={event => patch({ notifyGuests: event.target.checked })}/>Enviar invitaciones por correo a los participantes</label>
          <label className="calendar-check"><input type="checkbox" checked={draft.googleMeet} onChange={event => patch({ googleMeet: event.target.checked })}/>Generar enlace de Google Meet (si tu cuenta lo permite)</label>
        </fieldset>
        {error ? <p className="field-error is-wide" role="alert">{error}</p> : null}
        {retrying ? <p className="lead-small">Conservamos esta solicitud para reintentar sin duplicar el evento. Si necesitas corregir datos, cierra el formulario y revisa la reunión pendiente en Agenda.</p> : null}
      </form> : null}
    </Modal>
  </>;
}
