'use client';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Calendar, Danger, MessageText, TickCircle } from 'iconsax-reactjs';
import { checklist, completedChecks, followUpSchedule, followUps, stages, type ChecklistField, type DeliveryCard, type FollowUpKind } from '@/modules/polizas/delivery';
import { formatDate } from '@/modules/resources/config';
import { apiFetch, ApiError } from './ui/client-api';
import { EmptyState } from './ui/empty-state';
import { Modal } from './ui/modal';
import { riseIn } from './ui/motion';
import { useToast } from './ui/toast';
import { initials, teammateLabel, useTeam } from './ui/use-team';
type Draft = { deliveredAt: string; referralPotential: boolean; checks: Record<ChecklistField, boolean>; followUps: Partial<Record<FollowUpKind, boolean>> };
const today = () => new Date().toISOString().slice(0, 10);
const shortDate = (value: string) => new Intl.DateTimeFormat('es-MX', { timeZone: 'UTC', day: 'numeric', month: 'short' }).format(new Date(value.length === 10 ? value + 'T00:00:00.000Z' : value));
const toDraft = (card: DeliveryCard): Draft => ({
  deliveredAt: card.deliveredAt?.slice(0, 10) ?? '', referralPotential: card.referralPotential, checks: { ...card.checks },
  followUps: Object.fromEntries(card.followUps.map(item => [item.kind, item.status === 'DONE'])),
});
// Active delivery board (Ruta AJ, sprint día 6): every active policy moves from "emitida" to "posible referido".
export function DeliveryBoard({ initial, canEdit, me, initialOwner, openId }: { initial: DeliveryCard[]; canEdit: boolean; me: string; initialOwner: string | null; openId?: string }) {
  const [cards, setCards] = useState(initial);
  const [owner, setOwner] = useState<string | null>(initialOwner);
  const [selected, setSelected] = useState<DeliveryCard | null>(() => openId ? initial.find(card => card.id === openId) ?? null : null);
  const [open, setOpen] = useState(Boolean(selected));
  const [draft, setDraft] = useState<Draft | null>(() => selected ? toDraft(selected) : null);
  const [saving, setSaving] = useState(false);
  const team = useTeam();
  const toast = useToast();
  const boardRef = useRef<HTMLDivElement>(null);
  const visible = owner ? cards.filter(card => card.ownerEmail === owner) : cards;
  const overdue = visible.filter(card => card.next?.overdue).length;
  const reload = useCallback(async () => {
    try { setCards((await apiFetch<{ data: DeliveryCard[] }>('/api/policies/delivery-board')).data); } catch { /* keep the current board */ }
  }, []);
  useEffect(() => {
    const onRemote = (event: Event) => { const changed = (event as CustomEvent<{ module: string }>).detail.module; if (['entregas', 'polizas', 'actividades'].includes(changed)) void reload(); };
    window.addEventListener('aj:remote-change', onRemote);
    return () => window.removeEventListener('aj:remote-change', onRemote);
  }, [reload]);
  useEffect(() => {
    if (!openId) return;
    const url = new URL(window.location.href); url.searchParams.delete('open'); window.history.replaceState(null, '', url);
  }, [openId]);
  useLayoutEffect(() => { if (boardRef.current) riseIn(boardRef.current.querySelectorAll('.delivery-card'), 0.02); }, [owner, cards.length]);
  function openCard(card: DeliveryCard) { setSelected(card); setDraft(toDraft(card)); setOpen(true); }
  async function save() {
    if (!selected || !draft || !canEdit) return;
    setSaving(true);
    try {
      const { data } = await apiFetch<{ data: DeliveryCard }>(`/api/policies/${encodeURIComponent(selected.id)}/delivery`, { method: 'PATCH', json: { expectedUpdatedAt: selected.updatedAt, deliveredAt: draft.deliveredAt || null, referralPotential: draft.referralPotential, checks: draft.checks, followUps: draft.deliveredAt ? draft.followUps : {} } });
      setCards(current => current.map(card => card.id === data.id ? data : card));
      setOpen(false);
      const stage = stages.find(item => item.id === data.stage);
      toast({ kind: 'success', title: data.completed && !selected.completed ? 'Póliza completada' : 'Entrega actualizada', message: `${data.number} · ${stage?.label ?? ''}` });
    } catch (error) {
      toast({ kind: error instanceof ApiError && error.code === 'RECORD_CHANGED' ? 'warning' : 'error', title: 'No se guardó la entrega', message: error instanceof Error ? error.message : undefined, action: error instanceof ApiError && error.code === 'RECORD_CHANGED' ? { label: 'Recargar', onClick: () => void reload().then(() => setOpen(false)) } : undefined });
    } finally { setSaving(false); }
  }
  const people = team.filter(member => cards.some(card => card.ownerEmail === member.email));
  const stage = selected ? stages.find(item => item.id === selected.stage) : null;
  const delivered = Boolean(draft?.deliveredAt);
  const schedule = draft?.deliveredAt ? followUpSchedule(draft.deliveredAt) : [];
  return <>
    <div className="resource-toolbar">
      <div className="segmented" role="tablist" aria-label="Responsable">
        <button type="button" role="tab" aria-selected={owner === null} onClick={() => setOwner(null)}>Todas</button>
        <button type="button" role="tab" aria-selected={owner === me} onClick={() => setOwner(me)}>Mías</button>
        {people.filter(member => member.email !== me).map(member => <button key={member.email} type="button" role="tab" aria-selected={owner === member.email} onClick={() => setOwner(member.email)}>{member.name?.split(' ')[0] || member.email}</button>)}
      </div>
      <span className="resource-count">{visible.length} póliza{visible.length === 1 ? '' : 's'} activa{visible.length === 1 ? '' : 's'}{overdue ? ` · ${overdue} con seguimiento vencido` : ''}</span>
    </div>
    <p className="lead-small">Una póliza no termina cuando se envía el PDF: se completa cuando el cliente sabe usarla. Abre una tarjeta para registrar la entrega, el checklist y los seguimientos a 7, 30 y 90 días.</p>
    {visible.length ? <div ref={boardRef} className="delivery-board">{stages.map(column => { const items = visible.filter(card => card.stage === column.id); return <section key={column.id} className={`delivery-column stage-${column.id.toLowerCase()}`} aria-label={`${column.label}: ${items.length}`}>
      <header><strong>{column.label}</strong><span className="delivery-count">{items.length}</span><small>{column.hint}</small></header>
      <div className="delivery-column-body">{items.map(card => <button type="button" key={card.id} className={`delivery-card${card.next?.overdue ? ' is-overdue' : ''}`} onClick={() => openCard(card)}>
        <span className="delivery-card-top">
          <span className="delivery-thumb">
            {/* eslint-disable-next-line @next/next/no-img-element -- private signed URL */}
            {card.catalogProduct?.image ? <img src={card.catalogProduct.image} alt="" loading="lazy"/> : <span aria-hidden="true">{initials(card.catalogProduct?.name ?? card.product)}</span>}
          </span>
          <span className="delivery-card-title"><strong>{card.client.name}</strong><small>{card.catalogProduct?.name ?? card.product} · {card.number}</small></span>
          <span className="delivery-owner" title={teammateLabel(team, card.ownerEmail)}>{card.ownerEmail ? initials(teammateLabel(team, card.ownerEmail)) : '—'}</span>
        </span>
        <span className="delivery-progress" aria-label={`Checklist ${completedChecks({ ...card.checks, deliveredAt: card.deliveredAt, referralPotential: card.referralPotential })} de 5`}><i style={{ width: `${completedChecks({ ...card.checks, deliveredAt: card.deliveredAt, referralPotential: card.referralPotential }) * 20}%` }}/></span>
        <span className="delivery-card-meta">{card.next ? <span className={card.next.overdue ? 'is-late' : ''}>{card.next.overdue ? <Danger aria-hidden="true"/> : <Calendar aria-hidden="true"/>}{card.next.label.replace('Seguimiento de uso · ', 'Seguimiento ')} · {shortDate(card.next.dueDate)}</span> : card.deliveredAt ? <span><TickCircle aria-hidden="true"/>Entregada el {shortDate(card.deliveredAt)}</span> : <span>Sin entregar</span>}</span>
      </button>)}{!items.length ? <p className="delivery-empty">Sin pólizas aquí</p> : null}</div>
    </section>; })}</div>
    : <EmptyState illustration="polizas" title={owner ? 'Sin pólizas activas para este responsable' : 'Aún no hay pólizas activas'} message={owner ? 'Cambia el filtro para ver las del resto del equipo.' : 'Cuando registres una póliza, aparecerá aquí lista para su entrega activa.'} action={owner ? <button type="button" className="button button-soft" onClick={() => setOwner(null)}>Ver todas</button> : <Link className="button" href="/crm/clientes/nuevo">Nuevo expediente</Link>}/>}
    <Modal open={open} onClose={() => setOpen(false)} busy={saving} size="lg" className="delivery-modal"
      title={selected ? `Entrega activa · ${selected.number}` : 'Entrega activa'}
      description={selected ? `${selected.client.name} · ${selected.catalogProduct?.name ?? selected.product} · Responsable: ${teammateLabel(team, selected.ownerEmail)}` : undefined}
      footer={<>{selected ? <Link className="text-button" href={`/crm/clientes/${encodeURIComponent(selected.client.id)}`}>Ver expediente</Link> : null}<span className="modal-footer-spacer"/><button type="button" className="text-button" disabled={saving} onClick={() => setOpen(false)}>{canEdit ? 'Cancelar' : 'Cerrar'}</button>{canEdit ? <button type="button" className="button" disabled={saving} onClick={() => void save()}>{saving ? 'Guardando…' : 'Guardar'}</button> : null}</>}>
      {selected && draft && stage ? <div className="delivery-form">
        <blockquote className="delivery-guide"><MessageText aria-hidden="true"/><span><small>Mensaje guía · {stage.label}</small>{stage.message}</span></blockquote>
        <section><h3>1. Entrega</h3>
          <div className="delivery-date"><label><span className="form-label">Fecha de entrega</span><input type="date" value={draft.deliveredAt} max={today()} disabled={!canEdit || saving} onChange={event => setDraft({ ...draft, deliveredAt: event.target.value })}/></label>
            {canEdit && !draft.deliveredAt ? <button type="button" className="button button-soft" onClick={() => setDraft({ ...draft, deliveredAt: today() })}>Entregada hoy</button> : null}
            {canEdit && draft.deliveredAt ? <button type="button" className="text-button" onClick={() => setDraft({ ...draft, deliveredAt: '', referralPotential: false, checks: Object.fromEntries(checklist.map(item => [item.field, false])) as Draft['checks'], followUps: {} })}>Deshacer entrega</button> : null}</div>
        </section>
        <section><h3>2. Póliza completada <span className="delivery-score">{Object.values(draft.checks).filter(Boolean).length}/5</span></h3>
          {!delivered ? <p className="form-hint">Registra primero la fecha de entrega.</p> : null}
          <ul className="check-list">{checklist.map(item => <li key={item.field}><label><input type="checkbox" checked={draft.checks[item.field]} disabled={!canEdit || saving || !delivered} onChange={event => setDraft({ ...draft, checks: { ...draft.checks, [item.field]: event.target.checked } })}/><span>{item.label}</span></label></li>)}</ul>
        </section>
        <section><h3>3. Seguimiento de uso</h3>
          {!delivered ? <p className="form-hint">Al registrar la entrega se programan seguimientos a 7, 30 y 90 días para {teammateLabel(team, selected.ownerEmail)}.</p>
          : <ul className="check-list">{followUps.map(item => { const due = schedule.find(step => step.kind === item.kind)?.dueDate.toISOString().slice(0, 10) ?? ''; const doneNow = Boolean(draft.followUps[item.kind]); return <li key={item.kind}><label><input type="checkbox" checked={doneNow} disabled={!canEdit || saving} onChange={event => setDraft({ ...draft, followUps: { ...draft.followUps, [item.kind]: event.target.checked } })}/><span>{item.label}<small className={!doneNow && due < today() ? 'is-late' : ''}>{doneNow ? 'Hecho' : `${due < today() ? 'Vencido · ' : ''}${formatDate(due)}`}</small></span></label></li>; })}</ul>}
        </section>
        <section><h3>4. Recomendación</h3>
          <label className="check-line"><input type="checkbox" checked={draft.referralPotential} disabled={!canEdit || saving || !delivered} onChange={event => setDraft({ ...draft, referralPotential: event.target.checked })}/>Posible referido</label>
          <p className="form-hint">Pídela de forma natural, después de generar confianza (tras el seguimiento de 30 días).</p>
        </section>
      </div> : null}
    </Modal>
  </>;
}
