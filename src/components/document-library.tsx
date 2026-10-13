'use client';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type DragEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Add, Archive, ArrowRight3, Category, DocumentDownload, DocumentText, DocumentUpload, Edit2, Folder2, FolderOpen, More, RowVertical, Trash } from 'iconsax-reactjs';
import { apiFetch } from './ui/client-api';
import { useConfirm } from './ui/confirm';
import { EmptyState } from './ui/empty-state';
import { Modal } from './ui/modal';
import { riseIn } from './ui/motion';
import { useToast } from './ui/toast';
import { useUploads } from './ui/upload-manager';
import { usePreferences } from './ui/preferences';
export type DocumentRow = { id: string; name: string; mimeType: string; folderId: string | null; createdAt: string; updatedAt: string; client: { name: string } | null; policy: { number: string } | null; claim: { reference: string } | null };
export type FolderRow = { id: string; name: string; parentId: string | null; clientId: string | null; updatedAt: string };
export type DocumentOption = { id: string; label: string; kind: 'clientId' | 'policyId' | 'claimId' };
type Listing = { data: DocumentRow[]; folders: FolderRow[]; total: number };
const accept = '.pdf,.jpg,.jpeg,.png,.webp,.mp3,.ogg,.wav,.mp4';
const PAGE = 20;
const kindLabel = (mime: string) => mime === 'application/pdf' ? 'PDF' : mime.startsWith('image/') ? 'Imagen' : mime.startsWith('audio/') ? 'Audio' : mime.startsWith('video/') ? 'Video' : 'Archivo';
export function DocumentLibrary({ initial, initialTotal, initialFolders, options, canUpload, canDelete, configured, configurationMessage, clientId = null, clientName, initialFolderId = null }: { initialFolderId?: string | null; initial: DocumentRow[]; initialTotal: number; initialFolders: FolderRow[]; options: DocumentOption[]; canUpload: boolean; canDelete: boolean; configured: boolean; configurationMessage?: string; clientId?: string | null; clientName?: string }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const { enqueue } = useUploads();
  const [rows, setRows] = useState(initial);
  const [folders, setFolders] = useState(initialFolders);
  const [total, setTotal] = useState(initialTotal);
  const [folderId, setFolderId] = useState<string | null>(initialFolderId);
  const [skip, setSkip] = useState(0);
  const [query, setQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const { preferences, update: updatePreferences } = usePreferences();
  const [view, setViewState] = useState<'grid' | 'list'>(preferences.views.documentos ?? 'grid');
  const setView = (next: 'grid' | 'list') => { setViewState(next); updatePreferences({ views: { documentos: next } }); };
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [attachment, setAttachment] = useState('');
  const [folderModal, setFolderModal] = useState<FolderRow | 'new' | null>(null);
  const [folderName, setFolderName] = useState('');
  const [moving, setMoving] = useState<DocumentRow | null>(null);
  const [destination, setDestination] = useState('');
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLElement>(null);
  const position = useRef({ folderId: initialFolderId, skip: 0, query: '' });
  const path: FolderRow[] = [];
  for (let ancestor = folders.find(folder => folder.id === folderId), seen = new Set<string>(); ancestor && !seen.has(ancestor.id); ancestor = folders.find(folder => folder.id === ancestor?.parentId)) { seen.add(ancestor.id); path.unshift(ancestor); }
  const visibleFolders = folders.filter(folder => folder.parentId === folderId && (!activeQuery || folder.name.toLocaleLowerCase().includes(activeQuery.toLocaleLowerCase())));
  const currentLabel = path.at(-1)?.name ?? clientName ?? 'Archivos del equipo';
  const load = useCallback(async (target: string | null, nextSkip = 0, search = '', quiet = false) => {
    if (!quiet) setBusy(true);
    try {
      const params = new URLSearchParams({ take: String(PAGE), skip: String(nextSkip), q: search });
      if (target) params.set('folderId', target);
      if (clientId) params.set('clientId', clientId);
      const data = await apiFetch<Listing>('/api/documents?' + params);
      setRows(data.data); setTotal(data.total); setFolders(data.folders); setFolderId(target); setSkip(nextSkip); setActiveQuery(search); setQuery(search);
      position.current = { folderId: target, skip: nextSkip, query: search };
    } catch (error) { if (!quiet) toast({ kind: 'error', title: 'No se pudo abrir la carpeta', message: error instanceof Error ? error.message : undefined }); }
    finally { if (!quiet) setBusy(false); }
  }, [clientId, toast]);
  // Background uploads and teammates' changes refresh the open folder without interrupting the user.
  useEffect(() => {
    const refresh = () => { const { folderId: target, skip: at, query: search } = position.current; void load(target, at, search, true); };
    window.addEventListener('aj:documents-changed', refresh);
    return () => window.removeEventListener('aj:documents-changed', refresh);
  }, [load]);
  useLayoutEffect(() => { if (areaRef.current) riseIn(areaRef.current.querySelectorAll('[data-item]'), 0.025); }, [rows, folderId, view]);
  useEffect(() => {
    if (!menu) return;
    const close = (event: KeyboardEvent | PointerEvent) => { if (!(event instanceof KeyboardEvent) || event.key === 'Escape') setMenu(null); };
    document.addEventListener('keydown', close); document.addEventListener('pointerdown', close);
    return () => { document.removeEventListener('keydown', close); document.removeEventListener('pointerdown', close); };
  }, [menu]);
  function upload(files: File[], target = folderId) {
    if (!canUpload || !configured || !files.length) return;
    if (files.length > 50) { toast({ kind: 'warning', title: 'Demasiados archivos', message: 'Sube hasta 50 archivos por lote.' }); return; }
    const selected = options.find(option => `${option.kind}:${option.id}` === attachment);
    const label = target ? folders.find(folder => folder.id === target)?.name ?? 'la carpeta' : clientName ?? 'Archivos del equipo';
    enqueue(files, { folderId: target, clientId, attachment: !clientId && selected ? { field: selected.kind, id: selected.id } : null, label });
    if (fileRef.current) fileRef.current.value = '';
  }
  async function saveFolder() {
    if (!folderModal) return;
    setBusy(true);
    try {
      await apiFetch(folderModal === 'new' ? '/api/folders' : `/api/folders/${folderModal.id}`, { method: folderModal === 'new' ? 'POST' : 'PATCH', json: folderModal === 'new' ? { name: folderName, parentId: folderId, clientId } : { name: folderName, expectedUpdatedAt: folderModal.updatedAt } });
      toast({ kind: 'success', title: folderModal === 'new' ? 'Carpeta creada' : 'Carpeta renombrada', message: folderName.trim() });
      setFolderModal(null);
      await load(folderId, skip, activeQuery, true);
    } catch (error) { toast({ kind: 'error', title: 'No se guardó la carpeta', message: error instanceof Error ? error.message : undefined }); }
    finally { setBusy(false); }
  }
  async function deleteFolder(folder: FolderRow) {
    if (!await confirm({ title: 'Eliminar carpeta', message: `«${folder.name}» se eliminará. Solo es posible si está vacía, sin archivos ni subcarpetas.`, confirmLabel: 'Eliminar carpeta', tone: 'danger' })) return;
    try { await apiFetch(`/api/folders/${folder.id}`, { method: 'DELETE' }); setFolderModal(null); toast({ kind: 'success', title: 'Carpeta eliminada', message: folder.name }); await load(folderId, 0, activeQuery, true); }
    catch (error) { toast({ kind: 'warning', title: 'No se eliminó la carpeta', message: error instanceof Error ? error.message : undefined }); }
  }
  async function move(document: DocumentRow, target: string | null) {
    setBusy(true);
    try {
      await apiFetch(`/api/documents/${document.id}`, { method: 'PATCH', json: { folderId: target, clientId, expectedUpdatedAt: document.updatedAt } });
      setMoving(null);
      toast({ kind: 'success', title: 'Archivo movido', message: `${document.name} → ${target ? folders.find(folder => folder.id === target)?.name : 'la raíz'}` });
      await load(folderId, skip, activeQuery, true);
    } catch (error) { toast({ kind: 'error', title: 'No se movió el archivo', message: error instanceof Error ? error.message : undefined }); }
    finally { setBusy(false); }
  }
  async function archive(document: DocumentRow, archived = true) {
    if (archived && !await confirm({ title: 'Archivar archivo', message: `«${document.name}» dejará de verse en la biblioteca. Se conserva en el almacenamiento privado.`, confirmLabel: 'Archivar' })) return;
    try {
      await apiFetch(`/api/documents/${document.id}/archive`, { method: 'POST', json: { archived } });
      toast({ kind: 'success', title: archived ? 'Archivo archivado' : 'Archivo restaurado', message: document.name, action: archived ? { label: 'Deshacer', onClick: () => void archive(document, false) } : undefined });
      await load(folderId, skip, activeQuery, true);
    } catch (error) { toast({ kind: 'error', title: 'No se completó la acción', message: error instanceof Error ? error.message : undefined }); }
  }
  async function destroy(document: DocumentRow) {
    if (!await confirm({ title: 'Eliminar archivo definitivamente', message: `«${document.name}» se borrará de la base y del almacenamiento. Esta acción no se puede deshacer.`, confirmLabel: 'Eliminar para siempre', tone: 'danger' })) return;
    try { await apiFetch(`/api/documents/${document.id}`, { method: 'DELETE' }); toast({ kind: 'success', title: 'Archivo eliminado', message: document.name }); await load(folderId, rows.length === 1 && skip ? skip - PAGE : skip, activeQuery, true); }
    catch (error) { toast({ kind: 'error', title: 'No se eliminó el archivo', message: error instanceof Error ? error.message : undefined }); }
  }
  function drop(event: DragEvent, target = folderId) {
    event.preventDefault(); event.stopPropagation(); setDragging(false);
    if (busy || !canUpload) return;
    const id = event.dataTransfer.getData('application/x-aj-document');
    if (id) { const document = rows.find(row => row.id === id); if (document && document.folderId !== target) void move(document, target); return; }
    if (Array.from(event.dataTransfer.items).some(item => item.webkitGetAsEntry?.()?.isDirectory)) { toast({ kind: 'warning', title: 'Arrastra archivos, no carpetas', message: 'Crea la carpeta aquí y arrastra dentro sus archivos.' }); return; }
    upload(Array.from(event.dataTransfer.files), target);
  }
  const fileActions = (row: DocumentRow) => <div className="file-actions">
    {configured ? <a className="icon-button" href={`/api/documents/${row.id}/download`} referrerPolicy="no-referrer" aria-label={`Descargar ${row.name}`}><DocumentDownload aria-hidden="true"/></a> : null}
    {canUpload ? <button type="button" className="icon-button" aria-label={`Mover ${row.name}`} disabled={busy} onClick={() => { setMoving(row); setDestination(row.folderId ?? ''); }}><FolderOpen aria-hidden="true"/></button> : null}
    {canUpload ? <button type="button" className="icon-button" aria-label={`Archivar ${row.name}`} disabled={busy} onClick={() => void archive(row)}><Archive aria-hidden="true"/></button> : null}
    {canDelete ? <button type="button" className="icon-button is-danger" aria-label={`Eliminar ${row.name}`} disabled={busy} onClick={() => void destroy(row)}><Trash aria-hidden="true"/></button> : null}
  </div>;
  const openFolderEditor = (folder: FolderRow | 'new') => { setMenu(null); setFolderName(folder === 'new' ? '' : folder.name); setFolderModal(folder); };
  const empty = !rows.length && !visibleFolders.length;
  return <>
    <div className="drive-toolbar">
      <div><div className="eyebrow">BIBLIOTECA PRIVADA</div><h2>{clientName ? `Archivos de ${clientName}` : 'Archivos del equipo'}</h2></div>
      <div className="file-actions">
        {canUpload ? <><button type="button" className="button button-soft" disabled={busy} onClick={() => openFolderEditor('new')}><Add aria-hidden="true"/>Nueva carpeta</button><button type="button" className="button" disabled={!configured} onClick={() => fileRef.current?.click()}><DocumentUpload aria-hidden="true"/>Subir archivos</button></> : null}
        <div className="segmented" role="group" aria-label="Vista"><button type="button" aria-label="Tarjetas" aria-pressed={view === 'grid'} onClick={() => setView('grid')}><Category aria-hidden="true"/></button><button type="button" aria-label="Lista" aria-pressed={view === 'list'} onClick={() => setView('list')}><RowVertical aria-hidden="true"/></button></div>
      </div>
    </div>
    <p className="lead-small">Hasta 4 MB por archivo · {canUpload ? 'Las cargas siguen en segundo plano mientras navegas. Arrastra archivos aquí, o un archivo sobre una carpeta para moverlo.' : 'Acceso de consulta y descarga.'}</p>
    {!configured ? <p role="alert" className="notice">{configurationMessage || 'El almacenamiento no está disponible.'}</p> : null}
    <input type="file" multiple accept={accept} ref={fileRef} className="sr-only" tabIndex={-1} onChange={event => { if (event.target.files) upload(Array.from(event.target.files)); }}/>
    <form className="resource-filters" onSubmit={event => { event.preventDefault(); void load(folderId, 0, query.trim()); }}>
      <label className="search-field"><span className="sr-only">Buscar en esta carpeta</span><input type="search" value={query} placeholder="Buscar en esta carpeta" onChange={event => setQuery(event.target.value)} maxLength={100}/></label>
      <button className="button button-soft" disabled={busy}>Buscar</button>
      {canUpload && !clientId ? <label><span className="sr-only">Asociar nuevas cargas a</span><select value={attachment} onChange={event => setAttachment(event.target.value)}><option value="">Cargas generales del equipo</option>{options.map(option => <option key={`${option.kind}:${option.id}`} value={`${option.kind}:${option.id}`}>Vincular a: {option.label}</option>)}</select></label> : null}
      {!clientId ? <label><span className="sr-only">Abrir la biblioteca de un expediente</span><select value="" onChange={event => { if (event.target.value) router.push(`/crm/documentos?clientId=${encodeURIComponent(event.target.value)}`); }}><option value="">Abrir expediente…</option>{options.filter(option => option.kind === 'clientId').map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label> : <Link className="text-button" href="/crm/documentos">Archivos del equipo</Link>}
    </form>
    <nav className="drive-breadcrumb" aria-label="Ruta de carpetas"><button type="button" className="text-button" disabled={busy} onClick={() => void load(null)}>{clientName || 'Mi unidad'}</button>{path.map(folder => <span key={folder.id}><ArrowRight3 aria-hidden="true"/><button type="button" className="text-button" disabled={busy} onClick={() => void load(folder.id)}>{folder.name}</button></span>)}</nav>
    <section ref={areaRef} className={`drive-area${dragging ? ' is-dragging' : ''}`} aria-label={`Contenido de ${currentLabel}`} aria-busy={busy}
      onContextMenu={event => { if (!canUpload) return; event.preventDefault(); setMenu({ x: Math.max(8, Math.min(event.clientX, window.innerWidth - 220)), y: Math.max(8, Math.min(event.clientY, window.innerHeight - 120)) }); }}
      onDragOver={event => { event.preventDefault(); if (canUpload) setDragging(true); }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }} onDrop={event => drop(event)}>
      {dragging ? <div className="drop-hint" aria-hidden="true"><DocumentUpload/><strong>Suelta para subir a {currentLabel}</strong></div> : null}
      {empty ? <EmptyState illustration={activeQuery ? 'busqueda' : 'documentos'} title={activeQuery ? 'Sin coincidencias en esta carpeta' : folderId ? 'Esta carpeta está vacía' : 'Tu biblioteca está lista'} message={activeQuery ? 'Prueba con otro nombre o busca en otra carpeta.' : canUpload ? 'Arrastra archivos aquí o usa «Subir archivos». Se guardan de forma privada.' : 'Todavía no hay archivos.'}
        action={activeQuery ? <button type="button" className="button button-soft" onClick={() => void load(folderId)}>Limpiar búsqueda</button> : canUpload && configured ? <button type="button" className="button" onClick={() => fileRef.current?.click()}><DocumentUpload aria-hidden="true"/>Subir archivos</button> : undefined}/>
      : view === 'grid' ? <>
        {visibleFolders.length ? <div className="dossier-grid">{visibleFolders.map((folder, index) => <article data-item className={`dossier-card folder-tone-${index % 3}`} key={folder.id} onDragOver={event => event.preventDefault()} onDrop={event => drop(event, folder.id)}>
          <button type="button" className="folder-open" disabled={busy} onClick={() => void load(folder.id)}><Folder2 aria-hidden="true"/><h3>{folder.name}</h3><small>Abrir carpeta</small></button>
          {canUpload ? <button type="button" className="icon-button folder-menu" aria-label={`Opciones de ${folder.name}`} onClick={() => openFolderEditor(folder)}><More aria-hidden="true"/></button> : null}
        </article>)}</div> : null}
        {rows.length ? <div className="file-grid">{rows.map(row => <article data-item className="file-card" key={row.id} draggable={canUpload && !busy} onDragStart={event => event.dataTransfer.setData('application/x-aj-document', row.id)}>
          <DocumentText aria-hidden="true"/><h3>{row.name}</h3><p>{kindLabel(row.mimeType)} · {row.client?.name || row.policy?.number || row.claim?.reference || 'General'} · {row.createdAt.slice(0, 10)}</p>{fileActions(row)}
        </article>)}</div> : null}
      </> : <div className="table-wrap"><table><thead><tr><th>Nombre</th><th>Tipo</th><th>Expediente</th><th><span className="sr-only">Acciones</span></th></tr></thead><tbody>
        {visibleFolders.map(folder => <tr data-item key={folder.id} onDragOver={event => event.preventDefault()} onDrop={event => drop(event, folder.id)}><td><button type="button" className="row-link" disabled={busy} onClick={() => void load(folder.id)}><Folder2 aria-hidden="true"/>{folder.name}</button></td><td>Carpeta</td><td>—</td><td className="row-actions">{canUpload ? <button type="button" className="icon-button" aria-label={`Opciones de ${folder.name}`} onClick={() => openFolderEditor(folder)}><Edit2 aria-hidden="true"/></button> : null}</td></tr>)}
        {rows.map(row => <tr data-item key={row.id} draggable={canUpload && !busy} onDragStart={event => event.dataTransfer.setData('application/x-aj-document', row.id)}><td>{row.name}</td><td>{kindLabel(row.mimeType)}</td><td>{row.client?.name || row.policy?.number || row.claim?.reference || 'General'}</td><td className="row-actions">{fileActions(row)}</td></tr>)}
      </tbody></table></div>}
    </section>
    {total > PAGE ? <div className="document-pagination"><button type="button" className="text-button" disabled={busy || skip === 0} onClick={() => void load(folderId, Math.max(0, skip - PAGE), activeQuery)}>Anterior</button><span>{skip + 1}–{Math.min(skip + PAGE, total)} de {total} archivos</span><button type="button" className="text-button" disabled={busy || skip + PAGE >= total} onClick={() => void load(folderId, skip + PAGE, activeQuery)}>Siguiente</button></div> : null}
    {menu ? <div className="drive-context" style={{ left: menu.x, top: menu.y }} role="menu" onPointerDown={event => event.stopPropagation()}><button role="menuitem" type="button" onClick={() => openFolderEditor('new')}><Add aria-hidden="true"/>Nueva carpeta</button><button role="menuitem" type="button" disabled={!configured} onClick={() => { setMenu(null); fileRef.current?.click(); }}><DocumentUpload aria-hidden="true"/>Subir archivos</button></div> : null}
    <Modal open={folderModal !== null} onClose={() => setFolderModal(null)} busy={busy} size="sm" title={folderModal === 'new' ? 'Nueva carpeta' : 'Carpeta'} description={folderModal === 'new' ? `Dentro de ${currentLabel}` : 'Cambia su nombre o elimínala si está vacía.'}
      footer={<>{folderModal && folderModal !== 'new' ? <button type="button" className="text-button is-danger" disabled={busy} onClick={() => void deleteFolder(folderModal)}><Trash aria-hidden="true"/>Eliminar</button> : null}<span className="modal-footer-spacer"/><button type="button" className="text-button" disabled={busy} onClick={() => setFolderModal(null)}>Cancelar</button><button type="submit" form="folder-form" className="button" disabled={busy || !folderName.trim()}>Guardar</button></>}>
      <form id="folder-form" className="resource-form" onSubmit={event => { event.preventDefault(); void saveFolder(); }}><div className="form-field is-wide"><label><span className="form-label">Nombre de la carpeta</span><input data-autofocus value={folderName} required maxLength={100} onChange={event => setFolderName(event.target.value)}/></label></div></form>
    </Modal>
    <Modal open={moving !== null} onClose={() => setMoving(null)} busy={busy} size="sm" title="Mover archivo" description={moving?.name}
      footer={<><span className="modal-footer-spacer"/><button type="button" className="text-button" disabled={busy} onClick={() => setMoving(null)}>Cancelar</button><button type="submit" form="move-form" className="button" disabled={busy}>Mover aquí</button></>}>
      <form id="move-form" className="resource-form" onSubmit={event => { event.preventDefault(); if (moving) void move(moving, destination || null); }}><div className="form-field is-wide"><label><span className="form-label">Carpeta de destino</span><select data-autofocus value={destination} onChange={event => setDestination(event.target.value)}><option value="">{clientName || 'Mi unidad'} (raíz)</option>{folders.map(folder => <option value={folder.id} key={folder.id}>{folderPath(folder, folders)}</option>)}</select></label><small className="form-hint">Mover no cambia el expediente al que pertenece el archivo.</small></div></form>
    </Modal>
  </>;
}
function folderPath(folder: FolderRow, folders: FolderRow[]) {
  const names = [folder.name];
  for (let parent = folder.parentId, seen = new Set([folder.id]); parent && !seen.has(parent);) { seen.add(parent); const next = folders.find(item => item.id === parent); if (!next) break; names.unshift(next.name); parent = next.parentId; }
  return names.join(' / ');
}
