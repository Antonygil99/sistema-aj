'use client';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type DragEvent, type KeyboardEvent, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TickCircle, Add, Archive, ArrowRight3, ArrowRotateLeft, Category, DocumentDownload, DocumentText, DocumentUpload, Edit2, Folder2, FolderOpen, More, RowVertical, Send2, Trash } from '@/components/icons';
import {DocumentDelivery} from './document-delivery';
import type { ComposerRequest } from './email-composer';
import { folderColorOf, folderColors, folderPath, reachableFolders, type FolderColor } from '@/modules/documentos/folder-view';
import { ApiError, apiFetch } from './ui/client-api';
import { useConfirm } from './ui/confirm';
import { EmptyState } from './ui/empty-state';
import { Modal, portalTarget } from './ui/modal';
import { riseIn } from './ui/motion';
import { useToast } from './ui/toast';
import { useUploads } from './ui/upload-manager';
import { usePreferences } from './ui/preferences';
export type DocumentRow = { deliveryKind?:string; deliveryReviewed?:boolean; id: string; name: string; mimeType: string; folderId: string | null; createdAt: string; updatedAt: string; client: { name: string } | null; policy: { number: string } | null; claim: { reference: string } | null };
export type FolderRow = { id: string; name: string; parentId: string | null; clientId: string | null; color: string | null; updatedAt: string };
export type DocumentOption = { id: string; label: string; kind: 'clientId' | 'policyId' | 'claimId' };
type Listing = { data: DocumentRow[]; folders: FolderRow[]; total: number };
type ArchivedFolder = FolderRow & { archivedAt: string };
// Context menu: on a folder (open, rename, color, archive, delete) or on the empty area (new folder, upload, archived).
// `focus` gets the focus back when it closes with Escape; `toggle` is the ⋯ button that opened it, if any; `keyboard`
// marks a menu opened from the keyboard, whose first item takes the focus (with the mouse the menu itself does).
type Menu = { x: number; y: number; above: number | null; alignEnd: boolean; folder: FolderRow | null; focus: HTMLElement | null; toggle: HTMLElement | null; keyboard: boolean };
// Sending files by email: the composer downloads the first time it opens.
const EmailComposer = dynamic(() => import('./email-composer').then(module => module.EmailComposer), { ssr: false });
const accept = '.pdf,.jpg,.jpeg,.png,.webp,.mp3,.ogg,.wav,.mp4';
const PAGE = 20;
const kindLabel = (mime: string) => mime === 'application/pdf' ? 'PDF' : mime.startsWith('image/') ? 'Imagen' : mime.startsWith('audio/') ? 'Audio' : mime.startsWith('video/') ? 'Video' : 'Archivo';
const archivedDate = (value: string) => new Date(value).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Mexico_City' });
export function DocumentLibrary({ initial, initialTotal, initialFolders, options, canUpload, canDelete, configured, configurationMessage, clientId = null, clientName, initialFolderId = null, userName = '' }: { userName?: string; initialFolderId?: string | null; initial: DocumentRow[]; initialTotal: number; initialFolders: FolderRow[]; options: DocumentOption[]; canUpload: boolean; canDelete: boolean; configured: boolean; configurationMessage?: string; clientId?: string | null; clientName?: string }) {
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
  const [opening, setOpening] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [attachment, setAttachment] = useState('');
  const [folderModal, setFolderModal] = useState<FolderRow | 'new' | null>(null);
  const [folderName, setFolderName] = useState('');
  const [moving, setMoving] = useState<DocumentRow | null>(null);
  const [destination, setDestination] = useState('');
  const [menu, setMenu] = useState<Menu | null>(null);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [archived, setArchived] = useState<ArchivedFolder[] | null>(null);
  const [composer, setComposerState] = useState<ComposerRequest | null>(null);
  const [composerUsed, setComposerUsed] = useState(false);
  const sendByEmail = (documents: { id: string; name: string }[] = []) => { setComposerUsed(true); setComposerState({ kind: 'DOCUMENTOS', clientId, clientName, documents }); };
  const fileRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
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
  // The folder tilts open (same CSS as client dossiers) while its contents load.
  async function openFolder(target: string) { setOpening(target); try { await load(target); } finally { setOpening(null); } }
  // Background uploads and teammates' changes refresh the open folder without interrupting the user.
  useEffect(() => {
    const refresh = () => { const { folderId: target, skip: at, query: search } = position.current; void load(target, at, search, true); };
    window.addEventListener('aj:documents-changed', refresh);
    return () => window.removeEventListener('aj:documents-changed', refresh);
  }, [load]);
  useLayoutEffect(() => { if (areaRef.current) riseIn(areaRef.current.querySelectorAll('[data-item]'), 0.025); }, [rows, folderId, view]);
  // Keep the menu inside the viewport (above the phone tab bar) once its real size is known; a menu opened from ⋯
  // flips above its button when it does not fit below. Then move focus into it.
  useLayoutEffect(() => {
    const element = menuRef.current;
    if (!menu || !element) return;
    const { width, height } = element.getBoundingClientRect();
    const tabbar = document.querySelector('.mobile-tabbar')?.getBoundingClientRect();
    const bottom = (tabbar && tabbar.height ? tabbar.top : window.innerHeight) - 8;
    const top = menu.y + height > bottom && menu.above !== null && menu.above - height - 6 >= 8 ? menu.above - height - 6 : menu.y;
    element.style.left = `${Math.max(8, Math.min(menu.alignEnd ? menu.x - width : menu.x, window.innerWidth - width - 8))}px`;
    element.style.top = `${Math.max(8, Math.min(top, bottom - height))}px`;
    (menu.keyboard ? element.querySelector<HTMLElement>('[role^="menuitem"]:not(:disabled)') : element)?.focus({ preventScroll: true });
  }, [menu]);
  useEffect(() => {
    if (!menu) return;
    // React also listens on the document in the App Router, so stopPropagation inside the menu cannot keep this
    // listener from firing: check where the press landed instead (a press on the ⋯ toggle is left to its click).
    const outside = (event: PointerEvent) => { const target = event.target as Node; if (!menuRef.current?.contains(target) && !menu.toggle?.contains(target)) setMenu(null); };
    const dismiss = () => setMenu(null);
    document.addEventListener('pointerdown', outside);
    window.addEventListener('resize', dismiss);
    window.addEventListener('scroll', dismiss, true);
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', dismiss); window.removeEventListener('scroll', dismiss, true); };
  }, [menu]);
  function openMenu(event: MouseEvent<HTMLElement>, folder: FolderRow | null, focus: HTMLElement | null = null) {
    if (!canUpload) return;
    event.preventDefault(); event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    // The context-menu key and Shift+F10 report no pointer position: open over the element instead.
    const keyboard = event.clientX === 0 && event.clientY === 0;
    setMenu({ x: keyboard ? rect.left + 16 : event.clientX, y: keyboard ? rect.top + 16 : event.clientY, above: null, alignEnd: false, folder, focus, toggle: null, keyboard });
  }
  function toggleMenu(event: MouseEvent<HTMLElement>, folder: FolderRow) {
    const button = event.currentTarget;
    if (menu?.toggle === button) { setMenu(null); return; }
    const rect = button.getBoundingClientRect();
    setMenu({ x: rect.right, y: rect.bottom + 6, above: rect.top, alignEnd: true, folder, focus: button, toggle: button, keyboard: event.detail === 0 });
  }
  // Closing hands the focus back to the folder (so a dialog opened next grows from it and returns to it).
  function closeMenu(restoreFocus = false) {
    const target = menu?.focus;
    setMenu(null);
    if (restoreFocus && target && document.contains(target)) target.focus({ preventScroll: true });
  }
  function menuKeys(event: KeyboardEvent<HTMLDivElement>) {
    const items = [...event.currentTarget.querySelectorAll<HTMLElement>('[role^="menuitem"]:not(:disabled)')];
    const index = items.indexOf(document.activeElement as HTMLElement);
    const go = (next: number) => { event.preventDefault(); items[(next + items.length) % items.length]?.focus(); };
    if (event.key === 'Escape') { event.preventDefault(); closeMenu(true); }
    else if (event.key === 'Tab') closeMenu();
    else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') go(index + 1);
    else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') go(index - 1);
    else if (event.key === 'Home') go(0);
    else if (event.key === 'End') go(items.length - 1);
  }
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
    } catch (error) {
      const message = error instanceof ApiError && error.code === 'ALREADY_EXISTS' ? 'Ya hay una carpeta con ese nombre aquí (puede estar archivada).' : error instanceof Error ? error.message : undefined;
      toast({ kind: 'error', title: 'No se guardó la carpeta', message });
    }
    finally { setBusy(false); }
  }
  async function recolor(folder: FolderRow, color: FolderColor) {
    closeMenu(true);
    if (folderColorOf(folder) === color) return;
    setFolders(current => current.map(item => item.id === folder.id ? { ...item, color } : item));
    try {
      const { data } = await apiFetch<{ data: { color: string | null; updatedAt: string } }>(`/api/folders/${folder.id}`, { method: 'PATCH', json: { color, expectedUpdatedAt: folder.updatedAt } });
      setFolders(current => current.map(item => item.id === folder.id ? { ...item, ...data } : item));
    } catch (error) {
      setFolders(current => current.map(item => item.id === folder.id ? folder : item));
      toast({ kind: 'error', title: 'No se cambió el color', message: error instanceof Error ? error.message : undefined });
    }
  }
  async function loadArchived() {
    try { setArchived((await apiFetch<{ data: ArchivedFolder[] }>('/api/folders?' + new URLSearchParams(clientId ? { clientId } : {}))).data); }
    catch (error) { setArchived([]); toast({ kind: 'error', title: 'No se pudieron cargar las carpetas archivadas', message: error instanceof Error ? error.message : undefined }); }
  }
  function openArchived() { closeMenu(); setArchived(null); setArchivedOpen(true); void loadArchived(); }
  async function archiveFolder(folder: FolderRow, archive = true) {
    closeMenu();
    try {
      await apiFetch(`/api/folders/${folder.id}/archive`, { method: 'POST', json: { archived: archive } });
      toast({ kind: 'success', title: archive ? 'Carpeta archivada' : 'Carpeta restaurada', message: archive ? `«${folder.name}» y su contenido salen de la biblioteca hasta que la restaures.` : folder.name, action: archive ? { label: 'Deshacer', onClick: () => void archiveFolder(folder, false) } : undefined });
      await load(folderId, skip, activeQuery, true);
      if (archivedOpen) await loadArchived();
    } catch (error) { toast({ kind: 'error', title: 'No se completó la acción', message: error instanceof Error ? error.message : undefined }); }
  }
  async function deleteFolder(folder: FolderRow) {
    closeMenu();
    if (!await confirm({ title: 'Eliminar carpeta', message: `«${folder.name}» se eliminará. Solo es posible si está vacía, sin archivos ni subcarpetas.`, confirmLabel: 'Eliminar carpeta', tone: 'danger' })) return;
    try { await apiFetch(`/api/folders/${folder.id}`, { method: 'DELETE' }); toast({ kind: 'success', title: 'Carpeta eliminada', message: folder.name }); await load(folderId, 0, activeQuery, true); if (archivedOpen) await loadArchived(); }
    catch (error) { toast({ kind: 'warning', title: 'No se eliminó la carpeta', message: error instanceof ApiError && error.code === 'FOLDER_NOT_EMPTY' ? 'Tiene archivos o subcarpetas. Muévelos o archiva la carpeta.' : error instanceof Error ? error.message : undefined }); }
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
    {canUpload?<DocumentDelivery document={row} onSaved={()=>void load(folderId,skip,activeQuery)}/>:null}
    {configured ? <a className="icon-button" href={`/api/documents/${row.id}/download`} referrerPolicy="no-referrer" aria-label={`Descargar ${row.name}`}><DocumentDownload aria-hidden="true"/></a> : null}
    {canUpload && configured && row.deliveryReviewed ? <button type="button" className="icon-button" aria-label={`Enviar ${row.name} por correo`} onClick={() => sendByEmail([{ id: row.id, name: row.name }])}><Send2 aria-hidden="true"/></button> : null}
    {canUpload ? <button type="button" className="icon-button" aria-label={`Mover ${row.name}`} disabled={busy} onClick={() => { setMoving(row); setDestination(row.folderId ?? ''); }}><FolderOpen aria-hidden="true"/></button> : null}
    {canUpload ? <button type="button" className="icon-button" aria-label={`Archivar ${row.name}`} disabled={busy} onClick={() => void archive(row)}><Archive aria-hidden="true"/></button> : null}
    {canDelete ? <button type="button" className="icon-button is-danger" aria-label={`Eliminar ${row.name}`} disabled={busy} onClick={() => void destroy(row)}><Trash aria-hidden="true"/></button> : null}
  </div>;
  const openFolderEditor = (folder: FolderRow | 'new') => { closeMenu(true); setFolderName(folder === 'new' ? '' : folder.name); setFolderModal(folder); };
  const folderButton = (event: MouseEvent<HTMLElement>, selector: string) => event.currentTarget.querySelector<HTMLElement>(selector);
  const menuFolder = menu?.folder ?? null;
  const empty = !rows.length && !visibleFolders.length;
  const portal = menu ? portalTarget() : null;
  return <>
    <div className="drive-toolbar">
      <div><div className="eyebrow">BIBLIOTECA PRIVADA</div><h2>{clientName ? `Archivos de ${clientName}` : 'Archivos del equipo'}</h2></div>
      <div className="file-actions">
        {canUpload ? <><button type="button" className="button button-soft" disabled={busy} onClick={() => openFolderEditor('new')}><Add aria-hidden="true"/>Nueva carpeta</button><button type="button" className="button" disabled={!configured} onClick={() => fileRef.current?.click()}><DocumentUpload aria-hidden="true"/>Subir archivos</button>{clientId && configured ? <button type="button" className="button button-soft" onClick={() => sendByEmail()}><Send2 aria-hidden="true"/>Enviar por correo</button> : null}</> : null}
        <div className="segmented" role="group" aria-label="Vista"><button type="button" aria-label="Tarjetas" aria-pressed={view === 'grid'} onClick={() => setView('grid')}><Category aria-hidden="true"/></button><button type="button" aria-label="Lista" aria-pressed={view === 'list'} onClick={() => setView('list')}><RowVertical aria-hidden="true"/></button></div>
      </div>
    </div>
    <p className="lead-small">Hasta 4 MB por archivo · {canUpload ? 'Las cargas siguen en segundo plano mientras navegas. Arrastra archivos aquí, o un archivo sobre una carpeta para moverlo. Usa ⋯ o clic derecho sobre una carpeta para renombrarla, cambiarle el color, archivarla o eliminarla.' : 'Acceso de consulta y descarga.'}</p>
    {!configured ? <p role="alert" className="notice">{configurationMessage || 'El almacenamiento no está disponible.'}</p> : null}
    <input type="file" multiple accept={accept} ref={fileRef} className="sr-only" tabIndex={-1} onChange={event => { if (event.target.files) upload(Array.from(event.target.files)); }}/>
    <form className="resource-filters" onSubmit={event => { event.preventDefault(); void load(folderId, 0, query.trim()); }}>
      <label className="search-field"><span className="sr-only">Buscar en esta carpeta</span><input type="search" value={query} placeholder="Buscar en esta carpeta" onChange={event => setQuery(event.target.value)} maxLength={100}/></label>
      <button className="button button-soft" disabled={busy}>Buscar</button>
      {canUpload && !clientId ? <label><span className="sr-only">Asociar nuevas cargas a</span><select value={attachment} onChange={event => setAttachment(event.target.value)}><option value="">Cargas generales del equipo</option>{options.map(option => <option key={`${option.kind}:${option.id}`} value={`${option.kind}:${option.id}`}>Vincular a: {option.label}</option>)}</select></label> : null}
      {!clientId ? <label><span className="sr-only">Abrir la biblioteca de un expediente</span><select value="" onChange={event => { if (event.target.value) router.push(`/crm/documentos?clientId=${encodeURIComponent(event.target.value)}`); }}><option value="">Abrir expediente…</option>{options.filter(option => option.kind === 'clientId').map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label> : <Link className="text-button" href="/crm/documentos">Archivos del equipo</Link>}
    </form>
    <div className="drive-path">
      <nav className="drive-breadcrumb" aria-label="Ruta de carpetas"><button type="button" className="text-button" disabled={busy} onClick={() => void load(null)}>{clientName || 'Mi unidad'}</button>{path.map(folder => <span key={folder.id}><ArrowRight3 aria-hidden="true"/><button type="button" className="text-button" disabled={busy} onClick={() => void load(folder.id)}>{folder.name}</button></span>)}</nav>
      {canUpload ? <button type="button" className="text-button drive-archived" onClick={openArchived}><Archive aria-hidden="true"/>Archivadas</button> : null}
    </div>
    <section ref={areaRef} className={`drive-area${dragging ? ' is-dragging' : ''}`} aria-label={`Contenido de ${currentLabel}`} aria-busy={busy}
      onContextMenu={event => openMenu(event, null)}
      onDragOver={event => { event.preventDefault(); if (canUpload) setDragging(true); }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }} onDrop={event => drop(event)}>
      {dragging ? <div className="drop-hint" aria-hidden="true"><DocumentUpload/><strong>Suelta para subir a {currentLabel}</strong></div> : null}
      {empty ? <EmptyState illustration={activeQuery ? 'busqueda' : 'documentos'} title={activeQuery ? 'Sin coincidencias en esta carpeta' : folderId ? 'Esta carpeta está vacía' : 'Tu biblioteca está lista'} message={activeQuery ? 'Prueba con otro nombre o busca en otra carpeta.' : canUpload ? 'Arrastra archivos aquí o usa «Subir archivos». Se guardan de forma privada.' : 'Todavía no hay archivos.'}
        action={activeQuery ? <button type="button" className="button button-soft" onClick={() => void load(folderId)}>Limpiar búsqueda</button> : canUpload && configured ? <button type="button" className="button" onClick={() => fileRef.current?.click()}><DocumentUpload aria-hidden="true"/>Subir archivos</button> : undefined}/>
      : view === 'grid' ? <>
        {visibleFolders.length ? <div className="dossier-grid">{visibleFolders.map(folder => <article data-item className={`dossier-card doc-folder folder-color-${folderColorOf(folder)}`} key={folder.id}
          onContextMenu={event => openMenu(event, folder, folderButton(event, '.folder-open'))} onDragOver={event => event.preventDefault()} onDrop={event => drop(event, folder.id)}>
          {opening === folder.id ? <span className="link-pending" data-pending="true" aria-hidden="true"/> : null}
          <span className="folder-sheet" aria-hidden="true"/>
          <div className="folder-front">
            <button type="button" className="folder-open" disabled={busy} onClick={() => void openFolder(folder.id)}><span className="folder-icon" aria-hidden="true"><Folder2 size={26} className="folder-glyph-closed"/><FolderOpen size={26} className="folder-glyph-open"/></span><h3>{folder.name}</h3><small>Abrir carpeta</small></button>
            {canUpload ? <button type="button" className="icon-button folder-menu" aria-label={`Opciones de ${folder.name}`} aria-haspopup="menu" aria-expanded={menu?.toggle !== null && menuFolder?.id === folder.id} onClick={event => toggleMenu(event, folder)}><More aria-hidden="true"/></button> : null}
          </div>
        </article>)}</div> : null}
        {rows.length ? <div className="file-grid">{rows.map(row => <article data-item className="file-card" key={row.id} draggable={canUpload && !busy} onDragStart={event => event.dataTransfer.setData('application/x-aj-document', row.id)}>
          <DocumentText aria-hidden="true"/><h3>{row.name}</h3><p>{kindLabel(row.mimeType)} · {row.client?.name || row.policy?.number || row.claim?.reference || 'General'} · {row.createdAt.slice(0, 10)}</p>{fileActions(row)}
        </article>)}</div> : null}
      </> : <div className="table-wrap"><table><thead><tr><th>Nombre</th><th>Tipo</th><th>Expediente</th><th><span className="sr-only">Acciones</span></th></tr></thead><tbody>
        {visibleFolders.map(folder => <tr data-item key={folder.id} onContextMenu={event => openMenu(event, folder, folderButton(event, '.row-link'))} onDragOver={event => event.preventDefault()} onDrop={event => drop(event, folder.id)}><td><button type="button" className="row-link" disabled={busy} onClick={() => void openFolder(folder.id)}><Folder2 aria-hidden="true" className={`folder-ink folder-color-${folderColorOf(folder)}`}/>{folder.name}</button></td><td>Carpeta</td><td>—</td><td className="row-actions">{canUpload ? <button type="button" className="icon-button" aria-label={`Opciones de ${folder.name}`} aria-haspopup="menu" aria-expanded={menu?.toggle !== null && menuFolder?.id === folder.id} onClick={event => toggleMenu(event, folder)}><More aria-hidden="true"/></button> : null}</td></tr>)}
        {rows.map(row => <tr data-item key={row.id} draggable={canUpload && !busy} onDragStart={event => event.dataTransfer.setData('application/x-aj-document', row.id)}><td>{row.name}</td><td>{kindLabel(row.mimeType)}</td><td>{row.client?.name || row.policy?.number || row.claim?.reference || 'General'}</td><td className="row-actions">{fileActions(row)}</td></tr>)}
      </tbody></table></div>}
    </section>
    {total > PAGE ? <div className="document-pagination"><button type="button" className="text-button" disabled={busy || skip === 0} onClick={() => void load(folderId, Math.max(0, skip - PAGE), activeQuery)}>Anterior</button><span>{skip + 1}–{Math.min(skip + PAGE, total)} de {total} archivos</span><button type="button" className="text-button" disabled={busy || skip + PAGE >= total} onClick={() => void load(folderId, skip + PAGE, activeQuery)}>Siguiente</button></div> : null}
    {menu && portal ? createPortal(<div ref={menuRef} className="drive-context" role="menu" tabIndex={-1} aria-label={menuFolder ? `Opciones de ${menuFolder.name}` : `Acciones en ${currentLabel}`} style={{ left: menu.x, top: menu.y }} onKeyDown={menuKeys} onContextMenu={event => event.preventDefault()}>
      {menuFolder ? <>
        <button role="menuitem" type="button" onClick={() => { closeMenu(); void openFolder(menuFolder.id); }}><FolderOpen aria-hidden="true"/>Abrir</button>
        <button role="menuitem" type="button" onClick={() => openFolderEditor(menuFolder)}><Edit2 aria-hidden="true"/>Renombrar</button>
        <div className="drive-context-label" aria-hidden="true">Color</div>
        <div className="folder-swatches" role="group" aria-label="Color de la carpeta">{folderColors.map(color => <button key={color.id} role="menuitemradio" type="button" aria-checked={folderColorOf(menuFolder) === color.id} aria-label={color.label} data-tooltip={color.label} data-tooltip-always="" className={`folder-swatch folder-color-${color.id}`} onClick={() => void recolor(menuFolder, color.id)}/>)}</div>
        <hr/>
        <button role="menuitem" type="button" onClick={() => void archiveFolder(menuFolder)}><Archive aria-hidden="true"/>Archivar</button>
        <button role="menuitem" type="button" className="is-danger" onClick={() => void deleteFolder(menuFolder)}><Trash aria-hidden="true"/>Eliminar</button>
      </> : <>
        <button role="menuitem" type="button" onClick={() => openFolderEditor('new')}><Add aria-hidden="true"/>Nueva carpeta</button>
        <button role="menuitem" type="button" disabled={!configured} onClick={() => { closeMenu(); fileRef.current?.click(); }}><DocumentUpload aria-hidden="true"/>Subir archivos</button>
        <hr/>
        <button role="menuitem" type="button" onClick={openArchived}><Archive aria-hidden="true"/>Carpetas archivadas</button>
      </>}
    </div>, portal) : null}
    <Modal open={folderModal !== null} onClose={() => setFolderModal(null)} busy={busy} size="sm" title={folderModal === 'new' ? 'Nueva carpeta' : 'Renombrar carpeta'} description={folderModal === 'new' ? `Dentro de ${currentLabel}` : folderModal?.name}
      footer={<><span className="modal-footer-spacer"/><button type="button" className="text-button" disabled={busy} onClick={() => setFolderModal(null)}>Cancelar</button><button type="submit" form="folder-form" className="button" disabled={busy || !folderName.trim()}><TickCircle aria-hidden="true"/>Guardar</button></>}>
      <form id="folder-form" className="resource-form" onSubmit={event => { event.preventDefault(); void saveFolder(); }}><div className="form-field is-wide"><label><span className="form-label">Nombre de la carpeta</span><input data-autofocus value={folderName} required maxLength={100} onChange={event => setFolderName(event.target.value)}/></label></div></form>
    </Modal>
    <Modal open={archivedOpen} onClose={() => setArchivedOpen(false)} size="sm" title="Carpetas archivadas" description={`En ${clientName ? `el expediente de ${clientName}` : 'Archivos del equipo'}. Al restaurarlas vuelven con todo su contenido.`}
      footer={<><span className="modal-footer-spacer"/><button type="button" className="button button-soft" onClick={() => setArchivedOpen(false)}>Cerrar</button></>}>
      {archived === null ? <p className="lead-small" role="status">Cargando…</p> : !archived.length ? <p className="lead-small">No hay carpetas archivadas.</p>
        : <ul className="archived-folders">{archived.map(folder => <li key={folder.id}>
          <Folder2 aria-hidden="true" className={`folder-ink folder-color-${folderColorOf(folder)}`}/>
          <div><strong>{folder.name}</strong><small>Archivada el {archivedDate(folder.archivedAt)}{folder.parentId && !folders.some(item => item.id === folder.parentId) ? ' · está dentro de otra carpeta archivada' : ''}</small></div>
          <button type="button" className="button button-soft" onClick={() => void archiveFolder(folder, false)}><ArrowRotateLeft aria-hidden="true"/>Restaurar</button>
        </li>)}</ul>}
    </Modal>
    {composerUsed ? <EmailComposer request={composer} senderName={userName} onClose={() => setComposerState(null)}/> : null}
    <Modal open={moving !== null} onClose={() => setMoving(null)} busy={busy} size="sm" title="Mover archivo" description={moving?.name}
      footer={<><span className="modal-footer-spacer"/><button type="button" className="text-button" disabled={busy} onClick={() => setMoving(null)}>Cancelar</button><button type="submit" form="move-form" className="button" disabled={busy}>Mover aquí</button></>}>
      <form id="move-form" className="resource-form" onSubmit={event => { event.preventDefault(); if (moving) void move(moving, destination || null); }}><div className="form-field is-wide"><label><span className="form-label">Carpeta de destino</span><select data-autofocus value={destination} onChange={event => setDestination(event.target.value)}><option value="">{clientName || 'Mi unidad'} (raíz)</option>{reachableFolders(folders).map(folder => <option value={folder.id} key={folder.id}>{folderPath(folder, folders)}</option>)}</select></label><small className="form-hint">Mover no cambia el expediente al que pertenece el archivo.</small></div></form>
    </Modal>
  </>;
}
