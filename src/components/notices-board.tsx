'use client';
import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CloseCircle, Send2, TickCircle, Warning2 } from '@/components/icons';
import { noticeChannels, noticeKindLabels, type NoticeChannel, type NoticeKind, type NoticeView } from '@/modules/email/notices';
import type { TemplateKind } from '@/modules/email/template-text';
import type { ComposerRequest } from './email-composer';
import { TemplateEditor, type TemplateRow } from './template-editor';
import { apiFetch } from './ui/client-api';
import { EmptyState } from './ui/empty-state';
import { Modal } from './ui/modal';
import { useToast } from './ui/toast';
const EmailComposer = dynamic(() => import('./email-composer').then(module => module.EmailComposer), { ssr: false });
const tones: Record<NoticeKind, string> = { RENOVACION: 'tone-blue', PAGO: 'tone-sand', SINIESTRO: 'tone-red' };
const kinds: (NoticeKind | 'TODOS')[] = ['TODOS', 'RENOVACION', 'PAGO', 'SINIESTRO'];
const kindTabs: Record<NoticeKind | 'TODOS', string> = { TODOS: 'Todos', RENOVACION: 'Renovaciones', PAGO: 'Pagos', SINIESTRO: 'Siniestros' };
const statusText: Record<string, string> = { SENT: 'Correo enviado', NOTIFIED: 'Avisado', DISMISSED: 'Descartado' };
const otherChannels = (Object.keys(noticeChannels) as NoticeChannel[]).filter(channel => channel !== 'EMAIL');
const when = (iso: string) => new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', timeZone: 'America/Mexico_City' });
// Avisos: what to tell each client today. A person sends the suggested email, records another channel or dismisses.
export function NoticesBoard({ pending, resolved, scope, initialTab, canAct, templates, senderName, owners }: { pending: NoticeView[]; resolved: NoticeView[]; scope: 'mine' | 'all'; initialTab: 'avisos' | 'plantillas'; canAct: boolean; templates: TemplateRow[]; senderName: string; owners: Record<string, string> }) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTabState] = useState(initialTab);
  const [kind, setKind] = useState<NoticeKind | 'TODOS'>('TODOS');
  const [hidden, setHidden] = useState<string[]>([]);
  const [composer, setComposer] = useState<ComposerRequest | null>(null);
  const [composerUsed, setComposerUsed] = useState(false);
  const [notifying, setNotifying] = useState<NoticeView | null>(null);
  const [channel, setChannel] = useState<NoticeChannel>('TELEFONO');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const visible = pending.filter(notice => !hidden.includes(notice.id));
  const shown = kind === 'TODOS' ? visible : visible.filter(notice => notice.kind === kind);
  const counts = useMemo(() => Object.fromEntries(kinds.map(item => [item, item === 'TODOS' ? visible.length : visible.filter(notice => notice.kind === item).length])), [visible]);
  const setTab = (next: 'avisos' | 'plantillas') => { setTabState(next); window.history.replaceState(null, '', `/avisos?${new URLSearchParams({ ...(scope === 'all' ? { scope } : {}), ...(next === 'plantillas' ? { tab: next } : {}) })}`); };
  const ownerName = (email: string | null) => email ? owners[email] ?? email.split('@')[0] : 'Sin responsable';
  async function act(notice: NoticeView, body: { action: 'notified'; channel: NoticeChannel; note?: string } | { action: 'dismissed' }) {
    setBusy(true);
    try {
      await apiFetch(`/api/notices/${notice.id}`, { method: 'POST', json: body });
      setHidden(current => [...current, notice.id]);
      setNotifying(null);
      toast({ kind: 'success', title: body.action === 'notified' ? `Aviso registrado: ${noticeChannels[body.channel]}` : 'Aviso descartado', message: notice.client.name, action: { label: 'Deshacer', onClick: () => void undo(notice) } });
      router.refresh();
    } catch (error) { toast({ kind: 'error', title: 'No se guardó el aviso', message: error instanceof Error ? error.message : undefined }); }
    finally { setBusy(false); }
  }
  async function undo(notice: NoticeView) {
    try { await apiFetch(`/api/notices/${notice.id}`, { method: 'POST', json: { action: 'reopen' } }); setHidden(current => current.filter(id => id !== notice.id)); router.refresh(); }
    catch (error) { toast({ kind: 'error', title: 'No se pudo deshacer', message: error instanceof Error ? error.message : undefined }); }
  }
  function sendEmail(notice: NoticeView) {
    setComposerUsed(true);
    setComposer({ kind: notice.kind as TemplateKind, clientId: notice.client.id, clientName: notice.client.name, noticeId: notice.id });
  }
  return <div className="notices">
    {canAct ? <div className="segmented notices-tabs" role="tablist" aria-label="Secciones de Avisos">
      <button type="button" role="tab" aria-selected={tab === 'avisos'} onClick={() => setTab('avisos')}>Por avisar · {visible.length}</button>
      <button type="button" role="tab" aria-selected={tab === 'plantillas'} onClick={() => setTab('plantillas')}>Plantillas de correo</button>
    </div> : null}
    {tab === 'plantillas' && canAct ? <TemplateEditor templates={templates} senderName={senderName}/> : <>
      <div className="notices-toolbar">
        <div className="notice-kinds" role="group" aria-label="Tipo de aviso">{kinds.map(item => <button key={item} type="button" className="filter-chip" aria-pressed={kind === item} onClick={() => setKind(item)}>{kindTabs[item]} <span>{counts[item]}</span></button>)}</div>
        <div className="segmented" role="group" aria-label="Responsable">
          <Link href="/avisos" aria-current={scope === 'mine' ? 'page' : undefined}>A mi cargo</Link>
          <Link href="/avisos?scope=all" aria-current={scope === 'all' ? 'page' : undefined}>Todo el equipo</Link>
        </div>
      </div>
      {shown.length ? <ul className="notice-grid">{shown.map(notice => <li key={notice.id} className="notice-card">
        <div className="notice-card-top"><span className={`status-pill ${tones[notice.kind]}`}>{noticeKindLabels[notice.kind]}</span><strong className={notice.daysLeft <= 0 && notice.kind !== 'SINIESTRO' ? 'is-urgent' : undefined}>{notice.timing}</strong></div>
        <h3><Link href={`/crm/clientes/${notice.client.id}`}>{notice.client.name}</Link></h3>
        <p className="notice-detail">{notice.claim ? `Siniestro ${notice.claim.reference} · ` : ''}{notice.policy ? `${notice.policy.product} · ${notice.policy.insurer} · ${notice.policy.number}` : 'Póliza no disponible'}{notice.payment ? ` · ${notice.payment.amount}` : ''}</p>
        <p className="notice-owner">Responsable: {ownerName(notice.ownerEmail)}</p>
        {notice.needsReview ? <p className="notice-warning"><Warning2 aria-hidden="true"/>Recibo sin conciliar: confirma que siga pendiente antes de avisar.</p> : null}
        {!notice.client.reachable ? <p className="notice-warning"><Warning2 aria-hidden="true"/>Sin correo registrado. {notice.client.phone ? <a href={`tel:${notice.client.phone}`}>Llamar al {notice.client.phone}</a> : <Link href={`/crm/clientes/${notice.client.id}#contactos`}>Agrega un correo o contacto</Link>}</p> : null}
        {canAct ? <div className="notice-actions">
          <button type="button" className="button" disabled={!notice.client.reachable || busy} onClick={() => sendEmail(notice)}><Send2 aria-hidden="true"/>Enviar correo</button>
          <button type="button" className="button button-soft" disabled={busy} onClick={() => { setChannel('TELEFONO'); setNote(''); setNotifying(notice); }}><TickCircle aria-hidden="true"/>Ya le avisé</button>
          <button type="button" className="text-button" disabled={busy} onClick={() => void act(notice, { action: 'dismissed' })}><CloseCircle aria-hidden="true"/>Descartar</button>
        </div> : null}
      </li>)}</ul> : <EmptyState compact illustration="renovaciones" title={visible.length ? 'Nada de este tipo por ahora' : 'Todo al día'} message={visible.length ? 'Prueba con otro tipo de aviso.' : scope === 'mine' ? 'No hay avisos pendientes a tu cargo. Revisa «Todo el equipo» para ver los de los demás.' : 'No hay renovaciones, recibos ni siniestros que avisar hoy.'}/>}
      {resolved.length ? <details className="document-panel notices-resolved"><summary>Resueltos en los últimos 14 días · {resolved.length}</summary><ul>{resolved.map(notice => <li key={notice.id}>
        <TickCircle aria-hidden="true"/><span><strong>{notice.client.name}</strong> · {noticeKindLabels[notice.kind]} · {notice.status === 'NOTIFIED' && notice.channel ? `Avisado por ${noticeChannels[notice.channel as NoticeChannel]?.toLowerCase() ?? notice.channel}` : statusText[notice.status] ?? notice.status}{notice.resolvedByName ? ` · ${notice.resolvedByName}` : ''}{notice.resolvedAt ? ` · ${when(notice.resolvedAt)}` : ''}{notice.note ? <small>{notice.note}</small> : null}</span>
      </li>)}</ul></details> : null}
    </>}
    <Modal open={notifying !== null} onClose={() => setNotifying(null)} busy={busy} size="sm" title="Registrar aviso" description={notifying ? `${notifying.client.name} · ${noticeKindLabels[notifying.kind]}` : undefined}
      footer={<><span className="modal-footer-spacer"/><button type="button" className="text-button" disabled={busy} onClick={() => setNotifying(null)}>Cancelar</button><button type="submit" form="notice-form" className="button" disabled={busy}><TickCircle aria-hidden="true"/>Guardar</button></>}>
      <form id="notice-form" className="resource-form" onSubmit={event => { event.preventDefault(); if (notifying) void act(notifying, { action: 'notified', channel, note: note.trim() || undefined }); }}>
        <fieldset className="form-field is-wide notice-channels"><legend className="form-label">¿Cómo le avisaste?</legend>
          {otherChannels.map(item => <label key={item} className="email-check"><input type="radio" name="notice-channel" checked={channel === item} data-autofocus={item === 'TELEFONO' || undefined} onChange={() => setChannel(item)}/><span>{noticeChannels[item]}</span></label>)}
        </fieldset>
        <div className="form-field is-wide"><label><span className="form-label">Nota <span className="optional">Opcional</span></span><textarea rows={3} maxLength={500} value={note} placeholder="Por ejemplo: renovará con la misma suma asegurada" onChange={event => setNote(event.target.value)}/></label></div>
      </form>
    </Modal>
    {composerUsed ? <EmailComposer request={composer} senderName={senderName} onClose={() => setComposer(null)} onSent={() => { if (composer?.noticeId) setHidden(current => [...current, composer.noticeId!]); router.refresh(); }}/> : null}
  </div>;
}
