'use client';
import {Select} from '@/components/ui/select';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { TickCircle, Add, Archive, ArrowRight, ArrowRotateLeft, Kanban, Edit2, Eye, MessageText, Refresh2, RowVertical, SearchNormal1, Trash } from '@/components/icons';
import { currencies, formToBody, resources, rowToForm, type Field, type ResourceSlug, type Row, type Tone } from '@/modules/resources/config';
import { apiFetch, ApiError } from './ui/client-api';
import { useConfirm } from './ui/confirm';
import { EmptyState, type Illustration } from './ui/empty-state';
import { Modal } from './ui/modal';
import { RelationPicker } from './ui/relation-picker';
import { useToast } from './ui/toast';
import { gsap, isMobile, prefersReducedMotion, riseIn } from './ui/motion';
import { useDrag } from './ui/use-drag';
import { initials, teammateLabel, useTeam, type Teammate } from './ui/use-team';
import { usePreferences } from './ui/preferences';
import { isViewKey } from '@/modules/preferences';
import { productLineLabels } from '@/modules/resources/config';
type Page = { data: Row[]; total: number };
type Filters = { q: string; status: string; archived: boolean };
const PAGE = 20;
const nestedKey = (field: Field) => field.name.replace(/Id$/, '');
// Generic CRM table: search, filters, active/archived views, create/edit modal, archive/restore, permanent delete.
export function ResourceManager({ slug, initial, canEdit, canDelete, initialQuery = '', openId, initialView = 'list', toolbarStart }: { slug: ResourceSlug; initial: Page; canEdit: boolean; canDelete: boolean; initialQuery?: string; openId?: string; initialView?: 'list' | 'board'; toolbarStart?: ReactNode }) {
  const config = resources[slug];
  // A global-search result arrives with ?open=<id>: start with that record's card open.
  const [initialRow] = useState(() => openId ? initial.data.find(row => row.id === openId) ?? null : null);
  const [page, setPage] = useState(initial);
  const [skip, setSkip] = useState(0);
  const [draft, setDraft] = useState<Filters>({ q: initialQuery, status: '', archived: false });
  const [applied, setApplied] = useState<Filters>({ q: initialQuery, status: '', archived: false });
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Row | 'new' | null>(initialRow);
  const [modalOpen, setModalOpen] = useState(Boolean(initialRow));
  const [values, setValues] = useState<Record<string, string>>(() => rowToForm(config, initialRow));
  const [labels, setLabels] = useState<Record<string, string>>(() => relationLabels(config.fields, initialRow));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  // Errors shown under each field (from local checks or the API's validation issues).
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  // Snapshot of the form when it opened, to warn before discarding unsaved changes.
  const [snapshot, setSnapshot] = useState(() => JSON.stringify(rowToForm(config, initialRow)));
  const toast = useToast();
  const team = useTeam();
  // Catalog images are chosen in the form and uploaded right after the record is saved.
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const confirm = useConfirm();
  const listRef = useRef<HTMLDivElement>(null);
  const fieldLabels = Object.fromEntries(config.fields.map(field => [field.name, field.label]));
  const [view, setView] = useState<'list' | 'board'>(config.board ? initialView : 'list');
  const { update: updatePreferences } = usePreferences();
  const chooseView = (next: 'list' | 'board') => { setView(next); if (isViewKey(slug)) updatePreferences({ views: { [slug]: next } }); };
  const load = useCallback(async (nextSkip: number, filters: Filters, quiet = false, take = PAGE) => {
    if (!quiet) setLoading(true);
    try {
      const params = new URLSearchParams({ take: String(take), skip: String(nextSkip), q: filters.q, archived: filters.archived ? '1' : '0' });
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
  useEffect(() => {
    if (!openId) return;
    // Drop ?open from the address so a refresh does not reopen the card.
    const url = new URL(window.location.href); url.searchParams.delete('open'); window.history.replaceState(null, '', url);
  }, [openId]);
  useLayoutEffect(() => { if (listRef.current) riseIn(listRef.current.querySelectorAll('[data-row]'), 0.03); }, [page]);
  function openEditor(row: Row | 'new') {
    setEditing(row); setFormError('');
    const record = row === 'new' ? null : row;
    setValues(rowToForm(config, record));
    setLabels(relationLabels(config.fields, record));
    setImageFile(null); setRemoveImage(false); setFieldErrors({});
    setSnapshot(JSON.stringify(rowToForm(config, record)));
    setModalOpen(true);
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || saving || !canEdit) return;
    const body = formToBody(config, values);
    const local: Record<string, string> = {};
    if (body.phone && !/^\+?[1-9]\d{7,14}$/.test(body.phone)) local.phone = fieldMessages.tel;
    for (const field of config.fields) if (field.type === 'money' && body[field.name] && !/^\d{1,10}(\.\d{1,2})?$/.test(body[field.name])) local[field.name] = fieldMessages.money;
    if (Object.keys(local).length) { showFieldErrors(local, 'Corrige los campos marcados.'); return; }
    const modifying = editing !== 'new';
    setSaving(true); setFormError(''); setFieldErrors({});
    try {
      const saved = await apiFetch<{ data: Row }>(`/api/crm/${slug}${modifying ? '/' + encodeURIComponent(editing.id) : ''}`, { method: modifying ? 'PATCH' : 'POST', json: modifying ? { ...body, expectedUpdatedAt: editing.updatedAt } : body, labels: fieldLabels });
      if (config.imageUpload && saved.data?.id && (imageFile || (removeImage && modifying))) {
        try {
          if (imageFile) { const form = new FormData(); form.set('file', imageFile); await apiFetch(config.imageUpload(saved.data.id), { method: 'POST', body: form }); }
          else await apiFetch(config.imageUpload(saved.data.id), { method: 'DELETE' });
        } catch (error) { toast({ kind: 'warning', title: 'Se guardó, pero la imagen no', message: error instanceof Error ? error.message : undefined }); }
      }
      setModalOpen(false);
      toast({ kind: 'success', title: `${capitalize(config.singular)} ${modifying ? 'actualizad' : 'registrad'}${config.article === 'una' ? 'a' : 'o'}`, message: config.title({ ...(modifying ? editing : {}), ...body } as Row) || undefined });
      await load(modifying ? skip : 0, modifying ? applied : { ...applied, archived: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo guardar.';
      const byField = error instanceof ApiError ? issuesByField(error.issues, config.fields) : {};
      if (Object.keys(byField).length) showFieldErrors(byField, 'Corrige los campos marcados.');
      else setFormError(message);
      if (error instanceof ApiError && error.code === 'RECORD_CHANGED') toast({ kind: 'warning', title: 'Cambios en paralelo', message: 'Tu borrador sigue en el formulario. Recarga para ver la versión actual.', action: { label: 'Recargar', onClick: () => void reloadEditing() } });
    } finally { setSaving(false); }
  }
  function showFieldErrors(errors: Record<string, string>, summary: string) {
    setFieldErrors(errors); setFormError(summary);
    // Move focus to the first invalid field so keyboard and screen-reader users land on the problem.
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`#form-${slug} [aria-invalid="true"]`)?.focus());
  }
  const dirty = modalOpen && canEdit && !saving && (JSON.stringify(values) !== snapshot || Boolean(imageFile) || removeImage);
  async function requestClose() {
    if (saving) return;
    if (dirty && !await confirm({ title: 'Descartar cambios', message: 'Tienes cambios sin guardar en esta ficha. Si la cierras, se perderán.', confirmLabel: 'Descartar cambios', cancelLabel: 'Seguir editando', tone: 'danger' })) return;
    setModalOpen(false);
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
  const boardTake = view === 'board' ? 100 : PAGE;
  // Moves a record to the next board column with a full-form update (same rules and concurrency as the editor).
  async function advance(row: Row, next: string) {
    const body = formToBody(config, { ...rowToForm(config, row), status: next });
    try {
      await apiFetch(`/api/crm/${slug}/${encodeURIComponent(row.id)}`, { method: 'PATCH', json: { ...body, expectedUpdatedAt: row.updatedAt } });
      toast({ kind: 'success', title: `${config.title(row)} avanzó`, message: config.statuses?.[next] });
      await load(0, applied, true, boardTake);
    } catch (error) { toast({ kind: 'error', title: 'No se pudo avanzar', message: error instanceof Error ? error.message : undefined }); }
  }
  const statusOf = (row: Row) => typeof row.status === 'string' && config.statuses ? { label: config.statuses[row.status] ?? row.status, tone: config.statusTones?.[row.status] ?? 'neutral' } : null;
  return <div className="resource">
    <div className="resource-toolbar">
      {toolbarStart}
      <div className="segmented" role="tablist" aria-label="Vista">
        <button type="button" role="tab" aria-selected={!applied.archived} disabled={loading} onClick={() => { const next = { ...draft, archived: false }; setDraft(next); void load(0, next, false, boardTake); }}>Activos</button>
        <button type="button" role="tab" aria-selected={applied.archived} disabled={loading} onClick={() => { const next = { ...draft, archived: true }; setDraft(next); void load(0, next); }}>Archivados</button>
      </div>
      {config.board && !applied.archived ? <div className="segmented" role="group" aria-label="Forma de ver">
        <button type="button" aria-pressed={view === 'board'} onClick={() => { chooseView('board'); const next = { ...draft, status: '' }; setDraft(next); void load(0, next, false, 100); }}><Kanban aria-hidden="true"/>Embudo</button>
        <button type="button" aria-pressed={view === 'list'} onClick={() => { chooseView('list'); void load(0, applied); }}><RowVertical aria-hidden="true"/>Lista</button>
      </div> : null}
      <span className="resource-count">{page.total} {page.total === 1 ? config.singular : config.plural}</span>
      {canEdit&&['clientes','prospectos'].includes(slug)?<Link className="button button-soft" href={'/importaciones?destino='+slug}>Importar</Link>:null}
      {canEdit ? <button type="button" className="button" onClick={() => openEditor('new')}><Add aria-hidden="true"/>Nuev{config.article === 'una' ? 'a' : 'o'} {config.singular}</button> : <span className="badge">Acceso de consulta</span>}
    </div>
    <form className="resource-filters" onSubmit={event => { event.preventDefault(); void load(0, { ...draft, q: draft.q.trim() }, false, boardTake); }}>
      <label className="search-field"><SearchNormal1 aria-hidden="true"/><span className="sr-only">Buscar</span><input type="search" value={draft.q} placeholder={config.searchHint} maxLength={100} onChange={event => setDraft({ ...draft, q: event.target.value })}/></label>
      {config.statuses && !(config.board && view === 'board') ? <label className="sr-label"><span className="sr-only">Estado</span><Select value={draft.status} onChange={event => { const next = { ...draft, status: event.target.value }; setDraft(next); void load(0, next); }}><option value="">Todos los estados</option>{Object.entries(config.statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></label> : null}
      <button className="button button-soft" disabled={loading}>Buscar</button>
      <button type="button" className="icon-button" aria-label="Actualizar listado" disabled={loading} onClick={() => void load(skip, applied)}><Refresh2 aria-hidden="true" className={loading ? 'is-spinning' : ''}/></button>
    </form>
    <div ref={listRef} className="resource-list" aria-busy={loading}>
      {page.data.length && config.board && view === 'board' && !applied.archived ? <>
        <div className="delivery-board pipeline-board">{config.board.columns.map(column => { const items = page.data.filter(row => row.status === column); return <section key={column} className="delivery-column" aria-label={`${config.statuses?.[column] ?? column}: ${items.length}`}>
          <header><strong>{config.statuses?.[column] ?? column}</strong><span className="delivery-count">{items.length}</span></header>
          <div className="delivery-column-body">{items.map(row => { const progress = config.progress?.(row); const index = config.board!.columns.indexOf(column); const next = config.board!.columns[index + 1]; const owner = typeof row.ownerEmail === 'string' ? row.ownerEmail : null; return <article key={row.id} className="delivery-card pipeline-card">
            <button type="button" className="pipeline-card-main" onClick={() => openEditor(row)}>
              <span className="delivery-card-top"><span className="delivery-card-title"><strong>{config.title(row)}</strong><small>{config.columns[0].detail?.(row) || config.columns[1]?.value(row)}</small></span><span className="delivery-owner" title={teammateLabel(team, owner)}>{owner ? initials(teammateLabel(team, owner)) : '—'}</span></span>
              {progress ? <><span className="delivery-progress" aria-hidden="true"><i style={{ width: `${Math.round(progress.done / progress.total * 100)}%` }}/></span><span className="delivery-card-meta">{progress.label}</span></> : null}
            </button>
            {canEdit && next ? <button type="button" className="text-button pipeline-advance" onClick={() => void advance(row, next)}>Pasar a {config.statuses?.[next] ?? next}<ArrowRight aria-hidden="true"/></button> : null}
          </article>; })}{!items.length ? <p className="delivery-empty">Nadie en esta etapa</p> : null}</div>
        </section>; })}</div>
        <p className="lead-small">{config.board.hidden}</p>
      </>
      : page.data.length && config.layout === 'cards' ? <div className="catalog-grid">{page.data.map(row => <CatalogCard key={row.id} row={row} config={config} team={team} canEdit={canEdit} {...actions(row)}/>)}</div>
      : page.data.length ? <>
        <div className="table-wrap resource-table"><table><thead><tr>{config.columns.map(column => <th key={column.label}>{column.label}</th>)}{config.statuses ? <th>Estado</th> : null}<th><span className="sr-only">Acciones</span></th></tr></thead>
          <tbody>{page.data.map(row => { const status = statusOf(row); const act = actions(row); return <tr key={row.id} data-row>
            {config.columns.map((column, index) => <td key={column.label}>{index === 0 ? <button type="button" className="row-link" onClick={act.edit}>{column.value(row) || '—'}</button> : column.value(row) || '—'}{column.detail?.(row) ? <small>{column.detail(row)}</small> : null}</td>)}
            {status ? <td><StatusPill label={status.label} tone={status.tone}/></td> : null}
            <td className="row-actions"><button type="button" className="icon-button" aria-label={`${canEdit && !row.archivedAt ? 'Editar' : 'Ver'} ${config.title(row)}`} onClick={act.edit}>{canEdit && !row.archivedAt ? <Edit2 aria-hidden="true"/> : <Eye aria-hidden="true"/>}</button>
              {canEdit ? <button type="button" className="icon-button" aria-label={`${row.archivedAt ? 'Restaurar' : 'Archivar'} ${config.title(row)}`} onClick={act.archive}>{row.archivedAt ? <ArrowRotateLeft aria-hidden="true"/> : <Archive aria-hidden="true"/>}</button> : null}
              {act.remove ? <button type="button" className="icon-button is-danger" aria-label={`Eliminar ${config.title(row)}`} onClick={act.remove}><Trash aria-hidden="true"/></button> : null}</td>
          </tr>; })}</tbody></table></div>
        <ul className="resource-cards">{page.data.map((row, index) => <SwipeCard key={row.id} row={row} config={config} status={statusOf(row)} canEdit={canEdit} hint={index === 0} {...actions(row)}/>)}</ul>
      </> : <EmptyState illustration={(filtered ? 'busqueda' : config.illustration) as Illustration}
        title={filtered ? 'Sin coincidencias' : applied.archived ? `No hay ${config.plural} archivad${config.article === 'una' ? 'as' : 'os'}` : config.emptyTitle}
        message={filtered ? 'Prueba con otra búsqueda o quita los filtros.' : applied.archived ? 'Lo que archives aparecerá aquí para restaurarlo cuando lo necesites.' : config.emptyMessage}
        action={filtered ? <button type="button" className="button button-soft" onClick={() => { const next = { q: '', status: '', archived: applied.archived }; setDraft(next); void load(0, next); }}>Limpiar filtros</button> : canEdit && !applied.archived ? <button type="button" className="button" onClick={() => openEditor('new')}><Add aria-hidden="true"/>Registrar {config.article} {config.singular}</button> : undefined}/>}
    </div>
    {page.total > PAGE && view === 'list' ? <div className="document-pagination"><button type="button" className="text-button" disabled={loading || skip === 0} onClick={() => void load(Math.max(0, skip - PAGE), applied)}>Anterior</button><span>{skip + 1}–{Math.min(skip + PAGE, page.total)} de {page.total}</span><button type="button" className="text-button" disabled={loading || skip + PAGE >= page.total} onClick={() => void load(skip + PAGE, applied)}>Siguiente</button></div> : null}
    <Modal icon={readOnly?Eye:editingRow?Edit2:Add} open={modalOpen} onClose={() => void requestClose()} busy={saving} size="lg"
      title={editing === 'new' ? `Nuev${config.article === 'una' ? 'a' : 'o'} ${config.singular}` : readOnly ? capitalize(config.singular) : `Editar ${config.singular}`}
      description={editingRow?.archivedAt ? 'Archivado: restáuralo para poder editarlo.' : editingRow ? `Registrado el ${new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(editingRow.createdAt))}` : 'Los campos marcados con * son obligatorios.'}
      footer={<>{editingRow && canEdit ? <button type="button" className="text-button" disabled={saving} onClick={() => void setArchived(editingRow, !editingRow.archivedAt)}>{editingRow.archivedAt ? <><ArrowRotateLeft aria-hidden="true"/>Restaurar</> : <><Archive aria-hidden="true"/>Archivar</>}</button> : null}
        {editingRow && canDelete ? <button type="button" className="text-button is-danger" disabled={saving} onClick={() => void remove(editingRow)}><Trash aria-hidden="true"/>Eliminar</button> : null}
        {editingRow && config.modalLinks ? config.modalLinks(editingRow).map(link => <Link key={link.href} className={link.primary ? 'button button-soft' : 'text-button'} href={link.href}>{link.label}</Link>) : null}
        <span className="modal-footer-spacer"/>
        <button type="button" className="text-button" disabled={saving} onClick={() => void requestClose()}>{readOnly ? 'Cerrar' : 'Cancelar'}</button>
        {!readOnly ? <button type="submit" form={`form-${slug}`} className="button" disabled={saving}><TickCircle aria-hidden="true"/>{saving ? 'Guardando…' : 'Guardar'}</button> : null}</>}>
      <form id={`form-${slug}`} className="resource-form" onSubmit={save} noValidate={false}>
        {config.guide?.(values.status ?? '') ? <blockquote className="delivery-guide form-guide"><MessageText aria-hidden="true"/><span><small>Mensaje guía · {config.statuses?.[values.status] ?? ''}</small>{config.guide(values.status ?? '')}</span></blockquote> : null}
        {config.fields.filter(field => !field.showWhen || field.showWhen.values.includes(values[field.showWhen.field] ?? '')).flatMap((field, index) => [field.section ? <h3 key={`section-${field.name}`} className="form-section">{field.section}{config.progress ? <span className="delivery-score">{config.progress(values as unknown as Row).done}/{config.progress(values as unknown as Row).total}</span> : null}</h3> : null, <FieldInput key={field.name} field={field} value={values[field.name] ?? ''} label={labels[field.name] ?? ''} disabled={readOnly || saving} autoFocus={index === 0 && !readOnly && field.type !== 'image'}
          team={team} error={fieldErrors[field.name]} image={field.type === 'image' ? { current: removeImage || !editingRow ? null : config.image?.(editingRow) ?? null, file: imageFile, onFile: file => { setImageFile(file); setRemoveImage(false); }, onRemove: () => { setImageFile(null); setRemoveImage(true); } } : undefined}
          onChange={(value, label, related) => { if (fieldErrors[field.name]) setFieldErrors(current => { const next = { ...current }; delete next[field.name]; return next; }); setValues(current => ({ ...current, [field.name]: value, ...(related && config.prefill ? config.prefill(field.name, related, current) : {}) })); if (label !== undefined) setLabels(current => ({ ...current, [field.name]: label })); }}/>])}
        {formError ? <p role="alert" className="form-error">{formError}</p> : null}
      </form>
    </Modal>
  </div>;
}
function relationLabels(fields: Field[], record: Row | null) {
  return Object.fromEntries(fields.filter(field => field.type === 'relation').map(field => { const nested = record?.[nestedKey(field)] as Row | undefined; return [field.name, nested && field.relation ? labelFor(field, nested) : '']; }));
}
function labelFor(field: Field, nested: Row) {
  if (field.relation === 'polizas') return [nested.number, (nested.client as Row | undefined)?.name].filter(Boolean).join(' · ');
  if (field.relation === 'siniestros') return String(nested.reference ?? '');
  return String(nested.name ?? '');
}
function capitalize(text: string) { return text.charAt(0).toUpperCase() + text.slice(1); }
function StatusPill({ label, tone }: { label: string; tone: Tone }) { return <span className={`status-pill tone-${tone}`}>{label}</span>; }
type ImageControl = { current: string | null; file: File | null; onFile: (file: File) => void; onRemove: () => void };
function FieldInput({ field, value, label, disabled, autoFocus, onChange, team, image, error }: { field: Field; value: string; label: string; disabled: boolean; autoFocus: boolean; onChange: (value: string, label?: string, related?: Row) => void; team: Teammate[]; image?: ImageControl; error?: string }) {
  const title = <>{field.label}{field.required ? <span aria-hidden="true"> *</span> : <span className="optional">Opcional</span>}</>;
  const describedBy = [error ? `${field.name}-error` : '', field.hint ? `${field.name}-hint` : ''].filter(Boolean).join(' ') || undefined;
  const common = { disabled, required: field.required, 'data-autofocus': autoFocus || undefined, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy };
  let control;
  if (field.type === 'image' && image) return <div className="form-field is-wide"><span className="form-label">{field.label}<span className="optional">Opcional</span></span><ImageField control={image} disabled={disabled}/>{field.hint ? <small className="form-hint">{field.hint}</small> : null}</div>;
  if (field.type === 'relation' && field.relation) control = <RelationPicker relation={field.relation} value={value} initialLabel={label} label={field.label} required={field.required} disabled={disabled} onChange={(id, text, row) => onChange(id, text, row)}/>;
  else if (field.type === 'owner') control = <Select {...common} value={value} onChange={event => onChange(event.target.value)}><option value="">Sin asignar</option>{value && !team.some(member => member.email === value) ? <option value={value}>{value}</option> : null}{team.map(member => <option key={member.email} value={member.email}>{member.name ? `${member.name} · ${member.email}` : member.email}</option>)}</Select>;
  else if (field.type === 'textarea') control = <textarea {...common} value={value} maxLength={field.maxLength} rows={4} onChange={event => onChange(event.target.value)}/>;
  else if (field.type === 'select' || field.type === 'currency') control = <Select {...common} value={value} onChange={event => onChange(event.target.value)}>{!field.required ? <option value="">Sin especificar</option> : null}{Object.entries(field.type === 'currency' ? currencies : field.options ?? {}).filter(([key]) => !field.hiddenOptions?.includes(key) || key === value).map(([key, text]) => <option key={key} value={key}>{text}</option>)}</Select>;
  else control = <input {...common} value={value} maxLength={field.maxLength} placeholder={field.placeholder}
    type={field.type === 'money' ? 'text' : field.type === 'date' ? 'date' : field.type} inputMode={field.type === 'money' ? 'decimal' : undefined}
    autoComplete={field.type === 'email' ? 'email' : field.type === 'tel' ? 'tel' : field.name === 'name' ? 'name' : 'off'} onChange={event => onChange(event.target.value)}/>;
  return <div className={`form-field${field.wide || field.type === 'textarea' ? ' is-wide' : ''}${error ? ' is-invalid' : ''}`}>
    {field.type === 'relation' ? <span className="form-label">{title}</span> : null}
    {field.type === 'relation' ? control : <label><span className="form-label">{title}</span>{control}</label>}
    {error ? <small id={`${field.name}-error`} className="field-error">{error}</small> : null}
    {field.hint ? <small id={`${field.name}-hint`} className="form-hint">{field.hint}</small> : null}
  </div>;
}
// Mobile card: swipe left to reveal the actions, tap to open.
function SwipeCard({ row, config, status, canEdit, edit, archive, remove, hint = false }: { row: Row; config: (typeof resources)[ResourceSlug]; status: { label: string; tone: Tone } | null; canEdit: boolean; edit: () => void; archive: () => void; remove?: () => void; hint?: boolean }) {
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
  // Once per session, the first card peeks left to show that actions hide behind it.
  useEffect(() => {
    if (!hint || !width || !content.current || !isMobile() || prefersReducedMotion()) return;
    try { if (sessionStorage.getItem('aj:swipe-hint')) return; sessionStorage.setItem('aj:swipe-hint', '1'); } catch { return; }
    const el = content.current;
    const peek = gsap.timeline({ delay: 0.9, onStart: () => setActive(true), onComplete: () => setActive(false) }).to(el, { x: -56, duration: 0.35, ease: 'power2.out' }).to(el, { x: 0, duration: 0.45, ease: 'back.out(1.7)', delay: 0.35 });
    return () => { peek.kill(); gsap.set(el, { x: 0 }); };
  }, [hint, width]);
  const [first, ...rest] = config.columns;
  return <li className={`swipe-card${active ? ' is-active' : ''}`} data-row>
    {width ? <div className="swipe-actions" aria-hidden={!revealed}>{canEdit ? <button type="button" tabIndex={revealed ? 0 : -1} onClick={archive}>{row.archivedAt ? <ArrowRotateLeft aria-hidden="true"/> : <Archive aria-hidden="true"/>}<span>{row.archivedAt ? 'Restaurar' : 'Archivar'}</span></button> : null}{remove ? <button type="button" className="is-danger" tabIndex={revealed ? 0 : -1} onClick={remove}><Trash aria-hidden="true"/><span>Eliminar</span></button> : null}</div> : null}
    <div ref={content} className="swipe-content" {...drag}>
      <button type="button" className="swipe-main" onClick={() => { if (dragged.current) { dragged.current = false; return; } if (revealed) { setRevealed(false); if (content.current) gsap.to(content.current, { x: 0, duration: 0.25, onComplete: () => setActive(false) }); } else edit(); }}>
        <span className="swipe-title">{first.value(row) || '—'}</span>{first.detail?.(row) ? <small>{first.detail(row)}</small> : null}
        <span className="swipe-meta">{rest.map(column => column.value(row)).filter(Boolean).join(' · ')}</span>
      </button>
      {status ? <StatusPill label={status.label} tone={status.tone}/> : null}
      {width ? <span className="swipe-grip" aria-hidden="true"/> : null}
    </div>
  </li>;
}
function ImageField({ control, disabled }: { control: ImageControl; disabled: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const preview = useMemo(() => control.file ? URL.createObjectURL(control.file) : null, [control.file]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const shown = preview ?? control.current;
  return <div className="image-field">
    <div className="image-field-preview">
      {/* eslint-disable-next-line @next/next/no-img-element -- private signed URL or local preview */}
      {shown ? <img src={shown} alt="Vista previa del producto"/> : <span>Sin imagen</span>}
    </div>
    <div className="image-field-actions">
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" tabIndex={-1} disabled={disabled} onChange={event => { const file = event.target.files?.[0]; if (file) control.onFile(file); event.target.value = ''; }}/>
      <button type="button" className="button button-soft" disabled={disabled} onClick={() => input.current?.click()}>{shown ? 'Cambiar imagen' : 'Elegir imagen'}</button>
      {shown ? <button type="button" className="text-button is-danger" disabled={disabled} onClick={control.onRemove}>Quitar</button> : null}
    </div>
  </div>;
}
// Visual catalog card (products): image, name, insurer, line and responsible.
function CatalogCard({ row, config, team, canEdit, edit, archive, remove }: { row: Row; config: (typeof resources)[ResourceSlug]; team: Teammate[]; canEdit: boolean; edit: () => void; archive: () => void; remove?: () => void }) {
  const image = config.image?.(row) ?? null;
  const owner = typeof row.ownerEmail === 'string' ? row.ownerEmail : null;
  const ownerName = teammateLabel(team, owner);
  return <article className="catalog-card" data-row>
    <button type="button" className="catalog-card-main" onClick={edit} aria-label={`${canEdit && !row.archivedAt ? 'Editar' : 'Ver'} ${config.title(row)}`}>
      <span className="catalog-card-image">
        {/* eslint-disable-next-line @next/next/no-img-element -- private signed URL */}
        {image ? <img src={image} alt="" loading="lazy"/> : <span aria-hidden="true">{initials(config.title(row))}</span>}
      </span>
      <span className="catalog-card-body">
        <span className="catalog-card-line">{productLineLabels[row.line as keyof typeof productLineLabels] ?? ''}</span>
        <strong>{config.title(row)}</strong>
        <small>{typeof row.insurer === 'string' ? row.insurer : ''}</small>
        {typeof row.description === 'string' && row.description ? <span className="catalog-card-text">{row.description}</span> : null}
      </span>
    </button>
    <footer className="catalog-card-footer"><span className="catalog-owner" title={ownerName}><i aria-hidden="true">{owner ? initials(ownerName) : '—'}</i>{ownerName}</span>
      {canEdit ? <button type="button" className="icon-button" aria-label={`${row.archivedAt ? 'Restaurar' : 'Archivar'} ${config.title(row)}`} onClick={archive}>{row.archivedAt ? <ArrowRotateLeft aria-hidden="true"/> : <Archive aria-hidden="true"/>}</button> : null}
      {remove ? <button type="button" className="icon-button is-danger" aria-label={`Eliminar ${config.title(row)}`} onClick={remove}><Trash aria-hidden="true"/></button> : null}
    </footer>
  </article>;
}
// Spanish, field-level wording for the API's validation issues (business rules already arrive in Spanish).
const fieldMessages = {
  required: 'Este dato es obligatorio.', email: 'Escribe un correo válido, por ejemplo nombre@dominio.com.', tel: 'De 8 a 15 dígitos, sin espacios; puede iniciar con +.',
  money: 'Usa un importe como 1250.00.', date: 'Elige una fecha válida.', relation: 'Elige un registro de la lista.', other: 'Revisa este dato.',
};
function issuesByField(issues: { code?: string; message?: string; path?: (string | number)[] }[], fields: Field[]) {
  const result: Record<string, string> = {};
  for (const issue of issues) {
    const name = issue.path?.[0];
    const field = typeof name === 'string' ? fields.find(item => item.name === name) : undefined;
    if (!field || result[field.name]) continue;
    result[field.name] = issue.code === 'custom' && issue.message ? issue.message
      : issue.code === 'invalid_type' ? fieldMessages.required
      : field.type === 'email' || field.type === 'owner' ? fieldMessages.email
      : field.type === 'tel' ? fieldMessages.tel
      : field.type === 'money' ? fieldMessages.money
      : field.type === 'date' ? fieldMessages.date
      : field.type === 'relation' ? fieldMessages.relation
      : issue.code === 'too_small' ? fieldMessages.required : fieldMessages.other;
  }
  return result;
}
