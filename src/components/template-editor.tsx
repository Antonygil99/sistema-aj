'use client';
import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, RotateLeft } from '@/components/icons';
import { clientEmail } from '@/modules/email/templates';
import { fillTemplate, placeholderLabels, templateInfo, templateKinds, unknownPlaceholders, type Placeholder, type TemplateKind } from '@/modules/email/template-text';
import { apiFetch } from './ui/client-api';
import { useConfirm } from './ui/confirm';
import { useToast } from './ui/toast';
export type TemplateRow = { kind: TemplateKind; subject: string | null; body: string | null; updatedByName: string | null; updatedAt: string | null };
type Draft = { subject: string; body: string };
// Example data for the preview only; real emails use the client's and the notice's data.
const sample: Record<Placeholder, string> = { cliente: 'Ana López', asesor: '', poliza: 'MV-10293', producto: 'Médica Vital', aseguradora: 'MetLife', vence: '15 de noviembre de 2026', dias: '10', monto: '$1,250.00 MXN', referencia: 'SIN-2026-014' };
const textOf = (row: TemplateRow): Draft => ({ subject: row.subject ?? templateInfo[row.kind].defaults.subject, body: row.body ?? templateInfo[row.kind].defaults.body });
// The team's texts for each client email. {placeholders} take the client's and the record's data when composing;
// whatever is saved here is only a starting point the sender can still edit before sending.
export function TemplateEditor({ templates, senderName }: { templates: TemplateRow[]; senderName: string }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState(templates);
  const [selected, setSelected] = useState<TemplateKind>('BIENVENIDA');
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const [lastField, setLastField] = useState<'subject' | 'body'>('body');
  const row = rows.find(item => item.kind === selected)!;
  const saved = textOf(row);
  const draft = drafts[selected] ?? saved;
  const dirty = draft.subject !== saved.subject || draft.body !== saved.body;
  const info = templateInfo[selected];
  const errors = { subject: unknownPlaceholders(draft.subject), body: unknownPlaceholders(draft.body) };
  const html = useMemo(() => {
    if (!preview) return '';
    const values = { ...sample, asesor: senderName };
    return clientEmail({ subject: fillTemplate(draft.subject, values), message: fillTemplate(draft.body, values), senderName, attachments: [] }).html;
  }, [preview, draft.subject, draft.body, senderName]);
  const update = (patch: Partial<Draft>) => setDrafts(current => ({ ...current, [selected]: { ...draft, ...patch } }));
  async function choose(kind: TemplateKind) {
    if (kind === selected) return;
    if (dirty && !await confirm({ title: 'Descartar cambios', message: `Perderás los cambios sin guardar en «${info.label}».`, confirmLabel: 'Descartar', tone: 'danger' })) return;
    setDrafts(current => { const next = { ...current }; delete next[selected]; return next; });
    setSelected(kind); setPreview(false);
  }
  // Inserts {placeholder} where the cursor was in the subject or the body.
  function insert(name: Placeholder) {
    const field = lastField === 'subject' ? subjectRef.current : bodyRef.current;
    const current = lastField === 'subject' ? draft.subject : draft.body;
    const at = field?.selectionStart ?? current.length, end = field?.selectionEnd ?? at;
    const next = `${current.slice(0, at)}{${name}}${current.slice(end)}`;
    update(lastField === 'subject' ? { subject: next } : { body: next });
    requestAnimationFrame(() => { field?.focus(); field?.setSelectionRange(at + name.length + 2, at + name.length + 2); });
  }
  async function save() {
    if (errors.subject.length || errors.body.length) return;
    setBusy(true);
    try {
      await apiFetch(`/api/email-templates/${selected}`, { method: 'PUT', json: draft, labels: { subject: 'Asunto', body: 'Texto' } });
      setRows(current => current.map(item => item.kind === selected ? { ...item, ...draft, updatedByName: senderName, updatedAt: new Date().toISOString() } : item));
      setDrafts(current => { const next = { ...current }; delete next[selected]; return next; });
      toast({ kind: 'success', title: 'Plantilla guardada', message: info.label });
      router.refresh();
    } catch (error) { toast({ kind: 'error', title: 'No se guardó la plantilla', message: error instanceof Error ? error.message : undefined }); }
    finally { setBusy(false); }
  }
  async function reset() {
    if (!await confirm({ title: 'Volver al texto sugerido', message: `«${info.label}» usará de nuevo el texto sugerido por el sistema. Perderás el texto del equipo.`, confirmLabel: 'Restablecer' })) return;
    setBusy(true);
    try {
      await apiFetch(`/api/email-templates/${selected}`, { method: 'DELETE' });
      setRows(current => current.map(item => item.kind === selected ? { ...item, subject: null, body: null, updatedByName: null, updatedAt: null } : item));
      setDrafts(current => { const next = { ...current }; delete next[selected]; return next; });
      toast({ kind: 'success', title: 'Texto sugerido restablecido', message: info.label });
    } catch (error) { toast({ kind: 'error', title: 'No se restableció', message: error instanceof Error ? error.message : undefined }); }
    finally { setBusy(false); }
  }
  return <div className="template-editor">
    <nav className="template-list" aria-label="Plantillas">{templateKinds.map(kind => { const item = rows.find(entry => entry.kind === kind)!; return <button key={kind} type="button" aria-current={kind === selected ? 'true' : undefined} onClick={() => void choose(kind)}>
      <strong>{templateInfo[kind].label}</strong><small>{item.subject ? `Texto del equipo${item.updatedByName ? ` · ${item.updatedByName}` : ''}` : 'Texto sugerido'}</small>
    </button>; })}</nav>
    <section className="document-panel template-form" aria-labelledby="plantilla-titulo">
      <div className="contact-toolbar"><h2 id="plantilla-titulo">{info.label}</h2>{row.subject ? <span className="status-pill tone-green">Personalizada</span> : <span className="status-pill tone-neutral">Texto sugerido</span>}</div>
      <p className="lead-small">{info.hint} Quien envía siempre puede ajustar el texto antes de mandarlo.</p>
      {preview ? <div className="email-preview"><iframe title="Vista previa de la plantilla" sandbox="" srcDoc={html}/></div> : <div className="resource-form">
        <div className={`form-field is-wide${errors.subject.length ? ' is-invalid' : ''}`}><label><span className="form-label">Asunto</span>
          <input ref={subjectRef} value={draft.subject} maxLength={200} onFocus={() => setLastField('subject')} onChange={event => update({ subject: event.target.value })} aria-invalid={errors.subject.length ? true : undefined} aria-describedby={errors.subject.length ? 'plantilla-asunto-error' : undefined}/></label>
          {errors.subject.length ? <small id="plantilla-asunto-error" className="field-error">Marcador desconocido: {errors.subject.map(name => `{${name}}`).join(', ')}.</small> : null}</div>
        <div className={`form-field is-wide${errors.body.length ? ' is-invalid' : ''}`}><label><span className="form-label">Texto</span>
          <textarea ref={bodyRef} rows={11} value={draft.body} maxLength={10000} onFocus={() => setLastField('body')} onChange={event => update({ body: event.target.value })} aria-invalid={errors.body.length ? true : undefined} aria-describedby={errors.body.length ? 'plantilla-texto-error' : 'plantilla-texto-ayuda'}/></label>
          {errors.body.length ? <small id="plantilla-texto-error" className="field-error">Marcador desconocido: {errors.body.map(name => `{${name}}`).join(', ')}.</small> : null}
          <small id="plantilla-texto-ayuda" className="form-hint">Tu nombre y «AJ Consultoría de Seguros» se agregan como firma. Lo que escribas entre corchetes con la palabra «escribe» se debe completar antes de enviar.</small></div>
        <div className="form-field is-wide"><span className="form-label">Insertar dato</span><div className="placeholder-chips">{info.placeholders.map(name => <button key={name} type="button" className="filter-chip" onClick={() => insert(name)} title={placeholderLabels[name]}>{`{${name}}`} <span>{placeholderLabels[name]}</span></button>)}</div></div>
      </div>}
      <div className="template-actions">
        <button type="button" className="text-button" onClick={() => setPreview(value => !value)} aria-pressed={preview}><Eye aria-hidden="true"/>{preview ? 'Editar' : 'Vista previa con datos de ejemplo'}</button>
        <span className="modal-footer-spacer"/>
        {row.subject ? <button type="button" className="text-button" disabled={busy} onClick={() => void reset()}><RotateLeft aria-hidden="true"/>Volver al texto sugerido</button> : null}
        <button type="button" className="button" disabled={busy || !dirty || Boolean(errors.subject.length || errors.body.length) || !draft.subject.trim() || !draft.body.trim()} onClick={() => void save()}>Guardar</button>
      </div>
    </section>
  </div>;
}
