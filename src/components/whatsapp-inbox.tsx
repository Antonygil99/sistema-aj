'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Messages2, Refresh2, Send2 } from '@/components/icons';
import { apiFetch, ApiError } from './ui/client-api';
import { canReply } from '@/modules/whatsapp/parse';

type Message = { id: string; direction: string; kind: string; body: string; status: string; sentAt: string; senderName: string | null };
type Conversation = { id: string; displayName: string; contactId: string; phoneNumberId: string; lastInboundAt: string | null; lastMessageAt: string; closed: boolean; messages?: Message[] };
type Inbox = { rows: Conversation[]; total: number; open: number; sendingConfigured: boolean };
type Thread = { conversation: Conversation; rows: Message[]; hasMore: boolean; canSend: boolean };
const labels: Record<string, string> = { RECEIVED: 'Recibido', SENDING: 'Enviando', UNKNOWN: 'Confirmación pendiente', ACCEPTED: 'Aceptado por Meta', sent: 'Enviado', delivered: 'Entregado', read: 'Leído', failed: 'No enviado' };
const media: Record<string, string> = { image: 'Imagen recibida', audio: 'Audio recibido', video: 'Video recibido', document: 'Documento recibido', sticker: 'Sticker recibido', location: 'Ubicación recibida', contacts: 'Contacto recibido', interactive: 'Respuesta interactiva recibida', reaction: 'Reacción recibida', unsupported: 'Mensaje no compatible' };
const date = (value: string) => new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
const preview = (message?: Message) => message ? message.body || media[message.kind] || 'Mensaje recibido' : 'Sin mensajes';

export function WhatsAppInbox({ canWrite }: { canWrite: boolean }) {
  const [inbox, setInbox] = useState<Inbox | null>(null), [thread, setThread] = useState<Thread | null>(null);
  const [selected, setSelected] = useState<string | null>(null), [query, setQuery] = useState(''), [skip, setSkip] = useState(0);
  const [loading, setLoading] = useState(true), [threadLoading, setThreadLoading] = useState(false), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [body, setBody] = useState('');
  const selection = useRef<string | null>(null), request = useRef<{ id: string; body: string; thread: string } | null>(null);
  const pending = useRef(false), listVersion = useRef(0), threadVersion = useRef(0), mounted = useRef(true);
  const scrollArea = useRef<HTMLDivElement>(null), viewedThread = useRef<string | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const lastMessageId = thread?.rows.at(-1)?.id;
  useEffect(() => {
    const area = scrollArea.current;
    if (!area || !selected) return;
    const first = viewedThread.current !== selected;
    if (first || area.scrollHeight - area.scrollTop - area.clientHeight < 180) area.scrollTop = area.scrollHeight;
    viewedThread.current = selected;
  }, [selected, lastMessageId]);
  const loadInbox = useCallback(async (signal?: AbortSignal) => {
    const version = ++listVersion.current;
    try {
      const data = await apiFetch<Inbox>(`/api/whatsapp/conversations?q=${encodeURIComponent(query)}&skip=${skip}`, { signal });
      if (version === listVersion.current && mounted.current) { setInbox(data); setLoading(false); }
    } catch (e) { if (!signal?.aborted && version === listVersion.current && mounted.current) { setError((e as Error).message); setLoading(false); } }
  }, [query, skip]);
  const loadThread = useCallback(async (id: string, signal?: AbortSignal) => {
    const version = ++threadVersion.current;
    try {
      const data = await apiFetch<Thread>(`/api/whatsapp/conversations/${id}`, { signal });
      if (version === threadVersion.current && selection.current === id && mounted.current) {
        setThread(current => {
          if (!current || current.conversation.id !== id) return data;
          const merged = new Map([...current.rows, ...data.rows].map(row => [row.id, row]));
          return { ...data, hasMore: current.rows.length > 50 ? current.hasMore : data.hasMore,
            rows: [...merged.values()].sort((a, b) => a.sentAt.localeCompare(b.sentAt) || a.id.localeCompare(b.id)) };
        }); setThreadLoading(false);
      }
    } catch (e) { if (!signal?.aborted && version === threadVersion.current && mounted.current) { setError((e as Error).message); setThreadLoading(false); } }
  }, []);
  useEffect(() => { const controller = new AbortController(); const timer = setTimeout(() => { void loadInbox(controller.signal); }, 250); return () => { clearTimeout(timer); controller.abort(); }; }, [loadInbox]);
  useEffect(() => {
    const refresh = () => { if (document.hidden || pending.current) return; void loadInbox(); if (selection.current) void loadThread(selection.current); };
    const timer = setInterval(refresh, 15000); window.addEventListener('focus', refresh);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [loadInbox, loadThread]);
  function select(id: string | null) {
    if (pending.current) return;
    selection.current = id; viewedThread.current = null; threadVersion.current++; setSelected(id); setThread(null); setBody(''); request.current = null; setError(''); setNotice('');
    if (id) { setThreadLoading(true); void loadThread(id); }
  }
  async function refresh() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(''); setNotice('');
    try {
      if (canWrite) { const result = await apiFetch<{ more: boolean }>('/api/whatsapp/sync', { method: 'POST' }); if (result.more) setNotice('Hay más eventos pendientes. Pulsa actualizar de nuevo para continuar.'); }
      await loadInbox(); if (selection.current) await loadThread(selection.current);
    } catch (e) { setError((e as Error).message); } finally { pending.current = false; setBusy(false); }
  }
  async function send() {
    if (pending.current || !thread || !body.trim()) return;
    const id = thread.conversation.id, text = body.trim();
    if (!request.current || request.current.thread !== id || request.current.body !== text) request.current = { id: crypto.randomUUID(), body: text, thread: id };
    pending.current = true; setBusy(true); setError(''); setNotice('');
    try {
      await apiFetch(`/api/whatsapp/conversations/${id}/reply`, { method: 'POST', json: { body: text, requestId: request.current.id } });
      if (selection.current === id) { setBody(''); request.current = null; setNotice('Meta aceptó el mensaje. La entrega se actualizará cuando llegue su confirmación.'); }
    } catch (e) { setError((e as Error).message); if (e instanceof ApiError && e.code === 'WA_SEND_REJECTED') request.current = null; }
    finally { await loadThread(id); await loadInbox(); pending.current = false; setBusy(false); }
  }
  async function toggleClosed() {
    if (!thread || pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try { await apiFetch(`/api/whatsapp/conversations/${thread.conversation.id}`, { method: 'PATCH', json: { closed: !thread.conversation.closed } }); await loadThread(thread.conversation.id); await loadInbox(); }
    catch (e) { setError((e as Error).message); } finally { pending.current = false; setBusy(false); }
  }
  async function older() {
    if (!thread?.rows[0] || pending.current) return;
    const id = thread.conversation.id, cursor = thread.rows[0].id;
    pending.current = true; setBusy(true);
    try { const result = await apiFetch<Thread>(`/api/whatsapp/conversations/${id}?cursor=${encodeURIComponent(cursor)}`); if (selection.current === id) setThread(current => current ? { ...current, hasMore: result.hasMore, rows: [...result.rows, ...current.rows] } : current); }
    catch (e) { setError((e as Error).message); } finally { pending.current = false; setBusy(false); }
  }
  const windowOpen = canReply(thread?.conversation.lastInboundAt ?? null);
  const uncertain = thread?.rows.some(message => ['UNKNOWN', 'SENDING'].includes(message.status));
  const ready = canWrite && inbox?.sendingConfigured && thread?.canSend && windowOpen && !uncertain;
  return <section className="wa-workspace" aria-label="Bandeja de WhatsApp">
    <div className="wa-summary"><div><span>Conversaciones</span><strong>{inbox?.total ?? '—'}</strong></div><div><span>Por atender</span><strong>{inbox?.open ?? '—'}</strong></div><div><span>Envío manual</span><strong>{inbox ? inbox.sendingConfigured ? 'Configurado' : 'Pendiente' : '—'}</strong></div><div><span>Atención</span><strong>Humana</strong></div></div>
    <div className="wa-toolbar"><p>Actualización cada 15 segundos · acceso privado del equipo</p><button type="button" className="button button-soft" disabled={busy} onClick={() => void refresh()}><Refresh2 aria-hidden="true"/>{busy ? 'Actualizando…' : 'Actualizar recibidos'}</button></div>
    {error ? <p className="wa-alert" role="alert">{error}</p> : null}{notice ? <p className="wa-notice" role="status">{notice}</p> : null}
    <div className={`wa-columns${selected ? ' wa-selected' : ''}`}>
      <section className="wa-list" aria-label="Conversaciones"><label className="wa-search">Buscar contacto<input value={query} onChange={event => { setQuery(event.target.value); setSkip(0); }} placeholder="Nombre o número" type="search" maxLength={100}/></label>
        <div className="wa-contacts">{loading ? <p className="wa-empty" role="status">Cargando conversaciones…</p> : inbox?.rows.length ? inbox.rows.map(item => <button type="button" className={`wa-contact${selected === item.id ? ' is-selected' : ''}`} key={item.id} disabled={busy} onClick={() => select(item.id)} aria-pressed={selected === item.id}>
          <span className="wa-avatar" aria-hidden="true">{item.displayName.charAt(0).toUpperCase()}</span><span className="wa-contact-copy"><strong>{item.displayName}</strong><small>+{item.contactId}</small><span>{preview(item.messages?.[0])}</span><small>{date(item.lastMessageAt)} · {item.closed ? 'Resuelta' : 'Por atender'}</small></span>
        </button>) : <div className="wa-empty"><Messages2 aria-hidden="true"/><h2>{!inbox ? 'No pudimos cargar las conversaciones' : query ? 'Sin coincidencias' : 'Tu bandeja está lista'}</h2><p>{!inbox ? 'Pulsa Actualizar recibidos para volver a intentar.' : query ? 'Prueba otro nombre o número.' : 'Los mensajes nuevos aparecerán aquí. Para recuperar los que ya llegaron, pulsa Actualizar recibidos.'}</p></div>}</div>
        {inbox && inbox.total > 30 ? <div className="wa-pagination"><button type="button" disabled={skip === 0 || busy} onClick={() => setSkip(Math.max(0, skip - 30))}>Anterior</button><span>{skip + 1}–{Math.min(skip + 30, inbox.total)} de {inbox.total}</span><button type="button" disabled={skip + 30 >= inbox.total || busy} onClick={() => setSkip(skip + 30)}>Siguiente</button></div> : null}
      </section>
      <section className="wa-thread" aria-label="Mensajes de la conversación" aria-busy={threadLoading}>
        {thread ? <>
          <header className="wa-thread-header"><button type="button" className="wa-back" aria-label="Volver a conversaciones" disabled={busy} onClick={() => select(null)}><ArrowLeft/></button><div><h2>{thread.conversation.displayName}</h2><p>+{thread.conversation.contactId} · {thread.conversation.closed ? 'Resuelta' : 'Por atender'}</p><small>WhatsApp Business · atención humana</small></div>{canWrite ? <button type="button" className="text-button" disabled={busy} onClick={() => void toggleClosed()}>{thread.conversation.closed ? 'Reabrir' : 'Marcar resuelta'}</button> : null}</header>
          <div className="wa-messages" ref={scrollArea}>{thread.hasMore ? <button type="button" className="text-button wa-older" disabled={busy} onClick={() => void older()}>Ver mensajes anteriores</button> : null}
            {thread.rows.map(message => <article key={message.id} className={`wa-message ${message.direction === 'OUT' ? 'is-outgoing' : 'is-incoming'}`}><small>{message.direction === 'OUT' ? message.senderName || 'Equipo AJ' : thread.conversation.displayName}</small>
              {message.kind !== 'text' ? <p className="wa-media-label">{media[message.kind] || 'Mensaje recibido'} · Vista del archivo pendiente de integrar</p> : null}{message.body ? <p>{message.body}</p> : null}
              <footer><time dateTime={message.sentAt}>{date(message.sentAt)}</time><span>{labels[message.status] ?? message.status}</span></footer></article>)}
          </div>
          <form className="wa-composer" onSubmit={event => { event.preventDefault(); void send(); }}>
            {!canWrite ? <p>Tu cuenta tiene acceso de consulta.</p> : !inbox?.sendingConfigured || !thread.canSend ? <p>El envío aún no está configurado para este número empresarial.</p> : uncertain ? <p role="status">Hay un envío sin confirmar. No lo reenvíes: revisa la entrega en Meta antes de continuar.</p> : !windowOpen ? <p>La ventana de respuesta de 24 horas está cerrada. Se necesita una plantilla aprobada; esta bandeja todavía no envía plantillas.</p> : <p>Respuesta manual desde la cuenta seleccionada. Revisa el texto antes de enviarlo.</p>}
            <label className="sr-only" htmlFor="wa-reply">Tu respuesta</label><textarea id="wa-reply" rows={3} value={body} maxLength={4096} disabled={busy || !ready} onChange={event => setBody(event.target.value)} placeholder="Escribe una respuesta para este contacto…"/>
            <div><small>{body.length}/4096 · Los asistentes no responden automáticamente.</small><button type="submit" className="button" disabled={busy || !ready || !body.trim()}><Send2 aria-hidden="true"/>{busy ? 'Enviando…' : 'Enviar respuesta'}</button></div>
          </form>
        </> : <div className="wa-empty">{selected ? <button type="button" className="text-button" onClick={() => select(null)}><ArrowLeft aria-hidden="true"/>Volver a conversaciones</button> : null}<Messages2 aria-hidden="true"/><h2>{threadLoading ? 'Abriendo conversación…' : selected ? 'No pudimos abrir la conversación' : 'Una conversación a la vez'}</h2><p>{selected ? 'Puedes actualizar los mensajes o volver a la lista.' : 'Selecciona un contacto para revisar sus mensajes y responder desde su cuenta empresarial.'}</p><p>La IA se habilitará después de configurar el proveedor y revisar su alcance.</p></div>}
      </section>
    </div>
  </section>;
}
