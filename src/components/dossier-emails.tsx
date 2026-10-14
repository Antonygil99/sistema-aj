'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { DirectSend, Send2 } from '@/components/icons';
import { statusLabels, type EmailStatus } from '@/modules/email/rules';
import type { ComposerRequest } from './email-composer';
import { apiFetch } from './ui/client-api';
import { useToast } from './ui/toast';
export type EmailHistoryItem = { id: string; kind: string; subject: string; to: string[]; status: EmailStatus; sentByName: string; attachments: string[]; createdAt: string; sentAt: string | null };
const tones: Record<EmailStatus, string> = { SENDING: 'tone-neutral', SCHEDULED: 'tone-blue', SENT: 'tone-blue', DELIVERED: 'tone-green', BOUNCED: 'tone-red', COMPLAINED: 'tone-red', FAILED: 'tone-red', CANCELLED: 'tone-neutral' };
// The composer downloads the first time it opens and then stays mounted so its close animation plays.
const EmailComposer = dynamic(() => import('./email-composer').then(module => module.EmailComposer), { ssr: false });
const kinds: Record<string, string> = { DOCUMENTOS: 'Documentos', BIENVENIDA: 'Bienvenida' };
const when = (iso: string) => new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' });
// The emails written to this client (documents, welcome) and the buttons to write a new one.
export function DossierEmails({ clientId, clientName, senderName, initial, canSend }: { clientId: string; clientName: string; senderName: string; initial: EmailHistoryItem[]; canSend: boolean }) {
  const toast = useToast();
  const [history, setHistory] = useState(initial);
  const [request, setRequestState] = useState<ComposerRequest | null>(null);
  const [used, setUsed] = useState(false);
  const setRequest = (next: ComposerRequest | null) => { if (next) setUsed(true); setRequestState(next); };
  const welcomed = history.some(item => item.kind === 'BIENVENIDA' && (item.status === 'SENT' || item.status === 'DELIVERED'));
  async function refresh() {
    try { setHistory((await apiFetch<{ data: EmailHistoryItem[] }>(`/api/emails?clientId=${encodeURIComponent(clientId)}`)).data); }
    catch { toast({ kind: 'warning', title: 'No se actualizó el historial de correos' }); }
  }
  return <section className="document-panel dossier-emails" aria-labelledby="correos-titulo">
    <div className="contact-toolbar"><h2 id="correos-titulo">Correos</h2>
      {canSend ? <div className="file-actions">
        <button type="button" className="button button-soft" onClick={() => setRequest({ kind: 'BIENVENIDA', clientId, clientName })}><DirectSend aria-hidden="true"/>{welcomed ? 'Reenviar bienvenida' : 'Enviar bienvenida'}</button>
        <button type="button" className="button" onClick={() => setRequest({ kind: 'DOCUMENTOS', clientId, clientName })}><Send2 aria-hidden="true"/>Enviar documentos</button>
      </div> : null}
    </div>
    <p className="lead-small">Lo que le escribe el equipo desde el CRM. Nada se envía sin que alguien lo revise y dé clic en Enviar; las respuestas llegan al correo de quien lo envió.</p>
    {history.length ? <ul className="email-history">{history.map(item => <li key={item.id}>
      <div className="email-history-main"><strong>{item.subject}</strong><span className={`status-pill ${tones[item.status]}`}>{statusLabels[item.status]}</span></div>
      <small>{kinds[item.kind] ?? item.kind} · {when(item.sentAt ?? item.createdAt)} · {item.sentByName} → {item.to.join(', ')}</small>
      {item.attachments.length ? <small className="email-history-files">Adjuntos: {item.attachments.join(', ')}</small> : null}
    </li>)}</ul> : <p className="form-hint">Aún no se le han enviado correos desde el CRM.</p>}
    {used ? <EmailComposer request={request} senderName={senderName} onClose={() => setRequest(null)} onSent={() => void refresh()}/> : null}
  </section>;
}
