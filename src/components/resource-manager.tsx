'use client';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { Add, Archive, ArrowRotateLeft, Edit2, Eye, Refresh2, SearchNormal1, Trash } from 'iconsax-reactjs';
import { currencies, formToBody, resources, rowToForm, type Field, type ResourceSlug, type Row, type Tone } from '@/modules/resources/config';
import { apiFetch, ApiError } from './ui/client-api';
import { useConfirm } from './ui/confirm';
import { EmptyState, type Illustration } from './ui/empty-state';
import { Modal } from './ui/modal';
import { RelationPicker } from './ui/relation-picker';
import { useToast } from './ui/toast';
import { gsap, riseIn } from './ui/motion';
import { useDrag } from './ui/use-drag';
type Page = { data: Row[]; total: number };
type Filters = { q: string; status: string; archived: boolean };
const PAGE = 20;
const nestedKey = (field: Field) => field.name.replace(/Id$/, '');
// Generic CRM table: search, filters, active/archived views, create/edit modal, archive/restore, permanent delete.
export function ResourceManager({ slug, initial, canEdit, canDelete, initialQuery = '' }: { slug: ResourceSlug; initial: Page; canEdit: boolean; canDelete: boolean; initialQuery?: string }) {
  const config = resources[slug];
  const [page, setPage] = useState(initial);
  const [skip, setSkip] = useState(0);
  const [draft, setDraft] = useState<Filters>({ q: initialQuery, status: '', archived: false });
  const [applied, setApplied] = useState<Filters>({ q: initialQuery, status: '', archived: false });
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Row | 'new' | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const toast = useToast();
  const confirm = useConfirm();
  const listRef = useRef<HTMLDivElement>(null);
  const fieldLabels = Object.fromEntries(config.fields.map(field => [field.name, field.label]));
  const load = useCallback(async (nextSkip: number, filters: Filters, quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const params = new URLSearchParams({ take: String(PAGE), skip: String(nextSkip), q: filters.q, archived: filters.archived ? '1' : '0' });
      if (filters.status) params.set('status', filters.status);
      const result = await apiFetch<Page>(`/api/crm/${slug}?${params}`);
      setPage(result); setSkip(nextSkip); setApplied(filters);
    } catch (error) { if (!quiet) toast({ kind: 'error', title: 'No se pudo actualizar el listado', message: error instanceof Error ? error.message : undefined }); }
    finally { if (!quiet) setLoading(false); }
  }, [slug, toast]);
  // A teammate changed this module: refresh quietly unless the user is in the middle of editing.
  useEffect(() => {
    const onRemote = (event: Event) => { if ((event as CustomEvent<{ module: string }>).detail.module === slug && !modalOpen) void load(skip, applied, true); };
    window.addEventListener('aj:remote-change', onRemote);
    return () => window.removeEventListener('aj:remote-change', onRemote);
  }, [slug, modalOpen, load, skip, applied]);
  useLayoutEffect(() => { if (listRef.current) riseIn(listRef.current.querySelectorAll('[data-row]'), 0.03); }, [page]);
  function openEditor(row: Row | 'new') {
    setEditing(row); setFormError('');
    const record = row === 'new' ? null : row;
    setValues(rowToForm(config, record));
    setLabels(Object.fromEntries(config.fields.filter(field => field.type === 'relation').map(field => { const nested = record?.[nestedKey(field)] as Row | undefined; return [field.name, nested && field.relation ? labelFor(field, nested) : '']; })));
    setModalOpen(true);
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || saving || !canEdit) return;
    const body = formToBody(config, values);
    if (body.phone && !/^\+?[1-9]\d{7,14}$/.test(body.phone)) { setFormError('El teléfono debe tener entre 8 y 15 dígitos; puede iniciar con +.'); return; }
    for (const field of config.fields) if (field.type === 'money' && body[field.name] && !/^\d{1,10}(\.\d{1,2})?$/.test(body[field.name])) { setFormError(`Revisa el campo «${field.label}»: usa un importe como 1250.00.`); return; }
    const modifying = editing !== 'new';
    setSaving(true); setFormError('');
    try {
      await apiFetch(`/api/crm/${slug}${modifying ? '/' + encodeURIComponent(editing.id) : ''}`, { method: modifying ? 'PATCH' : 'POST', json: modifying ? { ...body, expectedUpdatedAt: editing.updatedAt } : body, labels: fieldLabels });
      setModalOpen(false);
      toast({ kind: 'success', title: `${capitalize(config.singular)} ${modifying ? 'actualizad' : 'registrad'}${config.article === 'una' ? 'a' : 'o'}`, message: config.title({ ...(modifying ? editing : {}), ...body } as Row) || undefined });
      await load(modifying ? skip : 0, modifying ? applied : { ...applied, archived: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo guardar.';
      setFormError(message);
      if (error instanceof ApiError && error.code === 'RECORD_CHANGED') toast({ kind: 'warning', title: 'Cambios en paralelo', message: 'Tu borrador sigue en el formulario. Recarga para ver la versión actual.', action: { label: 'Recargar', onClick: () => void reloadEditing() } });
    } finally { setSaving(false); }
  }
  async function reloadEditing() {
    if (!editing || editing === 'new') return;
    try { const { data } = await apiFetch<{ data: Row }>(`/api/crm/${slug}/${encodeURIComponent(editing.id)}`); openEditor(data); }
    catch (error) { toast({ kind: 'error', title: 'No se pudo recargar', message: error instanceof Error ? error.message : undefined }); }
  }
  async function setArchived(row: Row, archived: boolean) {
    const name = config.title(row);
    if (archived && !await confirm({ title: `Archivar ${config.singular}`, message: `«${name}» dejará de aparecer en los listados. Su historial se conserva y podrás restaurarl${config.article === 'una' ? 'a' : 'o'} cuando quieras.`, confirmLabel: 'Archivar' })) return;
    try {
      await apiFetch(`/api/crm/${slug}/${encodeURIComponent(row.id)}/archive`, { method: 'POST', json: { archived } });
      setModalOpen(false);
      toast({ kind: 'success', title: archived ? 'Archivado' : 'Restaurado', message: name, action: archived ? { label: 'Deshacer', onClick: () => void setArchived(row, false) } : undefined });
      await load(skip, applied, true);
    } catch (error) { toast({ kind: 'error', title: archived ? 'No se pudo archivar' : 'No se pudo restaurar', message: error instanceof Error ? error.message : undefined }); }
  }
  async function remove(row: Row) {
    const name = config.title(row);
    if (!await confirm({ title: `Eliminar ${config.singular} definitivamente`, message: `«${name}» se borrará para siempre. Solo es posible si no tiene información vinculada; esta acción no se puede deshacer.`, confirmLabel: 'Eliminar para siempre', tone: 'danger' })) return;
    try {
      await apiFetch(`/api/crm/${slug}/${encodeURIComponent(row.id)}`, { method: 'DELETE' });
      setModalOpen(false);
      toast({ kind: 'success', title: 'Eliminado definitivamente', message: name });
      await load(page.data.length === 1 && skip ? skip - PAGE : skip, applied, true);
    } catch (error) { toast({ kind: error instanceof ApiError && error.code === 'HAS_RELATIONS' ? 'warning' : 'error', title: 'No se eliminó', message: error instanceof Error ? error.message : undefined }); }
  }
  const filtered = Boolean(applied.q || applied.status);
  const actions = (row: Row) => ({ edit: () => openEditor(row), archive: () => void setArchived(row, !row.archivedAt), remove: canDelete ? () => void remove(row) : undefined });
  const editingRow = editing && editing !== 'new' ? editing : null;
  const readOnly = !canEdit || Boolean(editingRow?.archivedAt);
  const statusOf = (row: Row) => typeof row.status === 'string' && config.statuses ? { label: config.statuses[row.status] ?? row.status, tone: config.statusTones?.[row.status] ?? 'neutral' } : null;
  return <div className="resource">
    <div className="resource-toolbar">
      <div className="segmented" role="tablist" aria-label="Vista">
        <button type="button" role="tab" aria-selected={!applied.archived} disabled={loading} onClick={() => { const next = { ...draft, archived: false }; setDraft(next); void load(0, next); }}>Activos</button>
        <button type="button" role="tab" aria-selected={applied.archived} disabled={loading} onClick={() => { const next = { ...draft, archived: true }; setDraft(next); void load(0, next); }}>Archivados</button>
      </div>
      <span className="resource-count">{page.total} {page.total === 1 ? config.singular : config.plural}</span>
      {canEdit ? <button type="button" className="button" onClick={() => openEditor('new')}><Add aria-hidden="true"/>Nuev{config.article === 'una' ? 'a' : 'o'} {config.singular}</button> : <span className="badge">Acceso de consulta</span>}
    </div>
    <form className="resource-filters" onSubmit={event => { event.preventDefault(); void load(0, { ...draft, q: draft.q.trim() }); }}>
      <label className="search-field"><SearchNormal1 aria-hidden="true"/><span className="sr-only">Buscar</span><input type="search" value={draft.q} placeholder={config.searchHint} maxLength={100} onChange={event => setDraft({ ...draft, q: event.target.value })}/></label>
      {config.statuses ? <label className="sr-label"><span className="sr-only">Estado</span><select value={draft.status} onChange={event => { const next = { ...draft, status: event.target.value }; setDraft(next); void load(0, next); }}><option value="">Todos los estados</option>{Object.entries(config.statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label> : null}
      <button className="button button-soft" disabled={loading}>Buscar</button>
      <button type="button" className="icon-button" aria-label="Actualizar listado" disabled={loading} onClick={() => void load(skip, applied)}><Refresh2 aria-hidden="true" className={loading ? 'is-spinning' : ''}/></button>
    </form>
    <div ref={listRef} className="resource-list" aria-busy={loading}>
      {page.data.length ? <>
        <div className="table-wrap resource-table"><table><thead><tr>{config.columns.map(column => <th key={column.label}>{column.label}</th>)}{config.statuses ? <th>Estado</th> : null}<th><span className="sr-only">Acciones</span></th></tr></thead>
          <tbody>{page.data.map(row => { const status = statusOf(row); const act = actions(row); return <tr key={row.id} data-row>
            {config.columns.map((column, index) => <td key={column.label}>{index === 0 ? <button type="button" className="row-link" onClick={act.edit}>{column.value(row) || '—'}</button> : column.value(row) || '—'}{column.detail?.(row) ? <small>{column.detail(row)}</small> : null}</td>)}
            {status ? <td><StatusPill label={status.label} tone={status.tone}/></td> : null}
            <td className="row-actions"><button type="button" className="icon-button" aria-label={`${canEdit && !row.archivedAt ? 'Editar' : 'Ver'} ${config.title(row)}`} onClick={act.edit}>{canEdit && !row.archivedAt ? <Edit2 aria-hidden="true"/> : <Eye aria-hidden="true"/>}</button>
              {canEdit ? <button type="button" className="icon-button" aria-label={`${row.archivedAt ? 'Restaurar' : 'Archivar'} ${config.title(row)}`} onClick={act.archive}>{row.archivedAt ? <ArrowRotateLeft aria-hidden="true"/> : <Archive aria-hidden="true"/>}</button> : null}
              {act.remove ? <button type="button" className="icon-button is-danger" aria-label={`Eliminar ${config.title(row)}`} onClick={act.remove}><Trash aria-hidden="true"/></button> : null}</td>
          </tr>; })}</tbody></table></div>
        <ul className="resource-cards">{page.data.map(row => <SwipeCard key={row.id} row={row} config={config} status={statusOf(row)} canEdit={canEdit} {...actions(row)}/>)}</ul>
      </> : <EmptyState illustration={(filtered ? 'busqueda' : config.illustration) as Illustration}
        title={filtered ? 'Sin coincidencias' : applied.archived ? `No hay ${config.plural} archivad${config.article === 'una' ? 'as' : 'os'}` : config.emptyTitle}
        message={filtered ? 'Prueba con otra búsqueda o quita los filtros.' : applied.archived ? 'Lo que archives aparecerá aquí para restaurarlo cuando lo necesites.' : config.emptyMessage}
        action={filtered ? <button type="button" className="button button-soft" onClick={() => { const next = { q: '', status: '', archived: applied.archived }; setDraft(next); void load(0, next); }}>Limpiar filtros</button> : canEdit && !applied.archived ? <button type="button" className="button" onClick={() => openEditor('new')}><Add aria-hidden="true"/>Registrar {config.article} {config.singular}</button> : undefined}/>}
    </div>
    {page.total > PAGE ? <div className="document-pagination"><button type="button" className="text-button" disabled={loading || skip === 0} onClick={() => void load(Math.max(0, skip - PAGE), applied)}>Anterior</button><span>{skip + 1}–{Math.min(skip + PAGE, page.total)} de {page.total}</span><button type="button" className="text-button" disabled={loading || skip + PAGE >= page.total} onClick={() => void load(skip + PAGE, applied)}>Siguiente</button></div> : null}
    <Modal open={modalOpen} onClose={() => setModalOpen(false)} busy={saving} size="lg"
      title={editing === 'new' ? `Nuev${config.article === 'una' ? 'a' : 'o'} ${config.singular}` : readOnly ? capitalize(config.singular) : `Editar ${config.singular}`}
      description={editingRow?.archivedAt ? 'Archivado: restáuralo para poder editarlo.' : editingRow ? `Registrado el ${new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(editingRow.createdAt))}` : 'Los campos marcados con * son obligatorios.'}
      footer={<>{editingRow && canEdit ? <button type="button" className="text-button" disabled={saving} onClick={() => void setArchived(editingRow, !editingRow.archivedAt)}>{editingRow.archivedAt ? <><ArrowRotateLeft aria-hidden="true"/>Restaurar</> : <><Archive aria-hidden="true"/>Archivar</>}</button> : null}
        {editingRow && canDelete ? <button type="button" className="text-button is-danger" disabled={saving} onClick={() => void remove(editingRow)}><Trash aria-hidden="true"/>Eliminar</button> : null}
        <span className="modal-footer-spacer"/>
        <button type="button" className="text-button" disabled={saving} onClick={() => setModalOpen(false)}>{readOnly ? 'Cerrar' : 'Cancelar'}</button>
        {!readOnly ? <button type="submit" form={`form-${slug}`} className="button" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button> : null}</>}>
      <form id={`form-${slug}`} className="resource-form" onSubmit={save} noValidate={false}>
        {config.fields.filter(field => !field.showWhen || field.showWhen.values.includes(values[field.showWhen.field] ?? '')).map((field, index) => <FieldInput key={field.name} field={field} value={values[field.name] ?? ''} label={labels[field.name] ?? ''} disabled={readOnly || saving} autoFocus={index === 0 && !readOnly}
          onChange={(value, label) => { setValues(current => ({ ...current, [field.name]: value })); if (label !== undefined) setLabels(current => ({ ...current, [field.name]: label })); }}/>)}
        {formError ? <p role="alert" className="form-error">{formError}</p> : null}
      </form>
    </Modal>
  </div>;
}
function labelFor(field: Field, nested: Row) {
  if (field.relation === 'polizas') return [nested.number, (nested.client as Row | undefined)?.name].filter(Boolean).join(' · ');
  if (field.relation === 'siniestros') return String(nested.reference ?? '');
  return String(nested.name ?? '');
}
function capitalize(text: string) { return text.charAt(0).toUpperCase() + text.slice(1); }
function StatusPill({ label, tone }: { label: string; tone: Tone }) { return <span className={`status-pill tone-${tone}`}>{label}</span>; }
function FieldInput({ field, value, label, disabled, autoFocus, onChange }: { field: Field; value: string; label: string; disabled: boolean; autoFocus: boolean; onChange: (value: string, label?: string) => void }) {
  const title = <>{field.label}{field.required ? <span aria-hidden="true"> *</span> : <span className="optional">Opcional</span>}</>;
  const common = { disabled, required: field.required, 'data-autofocus': autoFocus || undefined };
  let control;
  if (field.type === 'relation' && field.relation) control = <RelationPicker relation={field.relation} value={value} initialLabel={label} label={field.label} required={field.required} disabled={disabled} onChange={(id, text) => onChange(id, text)}/>;
  else if (field.type === 'textarea') control = <textarea {...common} value={value} maxLength={field.maxLength} rows={4} onChange={event => onChange(event.target.value)}/>;
  else if (field.type === 'select' || field.type === 'currency') control = <select {...common} value={value} onChange={event => onChange(event.target.value)}>{!field.required ? <option value="">Sin especificar</option> : null}{Object.entries(field.type === 'currency' ? currencies : field.options ?? {}).map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select>;
  else control = <input {...common} value={value} maxLength={field.maxLength} placeholder={field.placeholder}
    type={field.type === 'money' ? 'text' : field.type === 'date' ? 'date' : field.type} inputMode={field.type === 'money' ? 'decimal' : undefined}
    autoComplete={field.type === 'email' ? 'email' : field.type === 'tel' ? 'tel' : field.name === 'name' ? 'name' : 'off'} onChange={event => onChange(event.target.value)}/>;
  return <div className={`form-field${field.wide || field.type === 'textarea' ? ' is-wide' : ''}`}>
    {field.type === 'relation' ? <span className="form-label">{title}</span> : null}
    {field.type === 'relation' ? control : <label><span className="form-label">{title}</span>{control}</label>}
    {field.hint ? <small className="form-hint">{field.hint}</small> : null}
  </div>;
}
// Mobile card: swipe left to reveal the actions, tap to open.
function SwipeCard({ row, config, status, canEdit, edit, archive, remove }: { row: Row; config: (typeof resources)[ResourceSlug]; status: { label: string; tone: Tone } | null; canEdit: boolean; edit: () => void; archive: () => void; remove?: () => void }) {
  const content = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);
  const [active, setActive] = useState(false);
  const dragged = useRef(false);
  const width = (canEdit ? 64 : 0) + (remove ? 64 : 0);
  const drag = useDrag({
    axis: 'x', ignoreInteractive: false,
    onMove: ({ dx }) => { dragged.current = true; setActive(true); if (content.current && width) gsap.set(content.current, { x: Math.max(-width - 24, Math.min(0, (revealed ? -width : 0) + dx)) }); },
    onEnd: ({ dx, vx }) => { const open = width > 0 && ((revealed ? -width : 0) + dx < -width / 2 || vx < -0.5); setRevealed(open); if (content.current) gsap.to(content.current, { x: open ? -width : 0, duration: 0.28, ease: 'power3.out', onComplete: () => setActive(open) }); },
  });
  const [first, ...rest] = config.columns;
  return <li className={`swipe-card${active ? ' is-active' : ''}`} data-row>
    {width ? <div className="swipe-actions" aria-hidden={!revealed}>{canEdit ? <button type="button" tabIndex={revealed ? 0 : -1} onClick={archive}>{row.archivedAt ? <ArrowRotateLeft aria-hidden="true"/> : <Archive aria-hidden="true"/>}<span>{row.archivedAt ? 'Restaurar' : 'Archivar'}</span></button> : null}{remove ? <button type="button" className="is-danger" tabIndex={revealed ? 0 : -1} onClick={remove}><Trash aria-hidden="true"/><span>Eliminar</span></button> : null}</div> : null}
    <div ref={content} className="swipe-content" {...drag}>
      <button type="button" className="swipe-main" onClick={() => { if (dragged.current) { dragged.current = false; return; } if (revealed) { setRevealed(false); if (content.current) gsap.to(content.current, { x: 0, duration: 0.25, onComplete: () => setActive(false) }); } else edit(); }}>
        <span className="swipe-title">{first.value(row) || '—'}</span>{first.detail?.(row) ? <small>{first.detail(row)}</small> : null}
        <span className="swipe-meta">{rest.map(column => column.value(row)).filter(Boolean).join(' · ')}</span>
      </button>
      {status ? <StatusPill label={status.label} tone={status.tone}/> : null}
    </div>
  </li>;
}
