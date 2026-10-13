'use client';
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowDown2, ArrowRotateRight, ArrowUp2, CloseCircle, DocumentUpload, TickCircle, Warning2 } from 'iconsax-reactjs';
import { FILE_TYPES, MAX_FILE_BYTES } from '@/modules/documentos/file-policy';
import { messageFor, signalSecurity } from './client-api';
import { gsap, prefersReducedMotion } from './motion';
import { useToast } from './toast';
import { useDrag } from './use-drag';
export type UploadTarget = { folderId: string | null; clientId: string | null; attachment?: { field: 'clientId' | 'policyId' | 'claimId'; id: string } | null; label: string };
type Status = 'queued' | 'uploading' | 'done' | 'error' | 'cancelled';
type Item = { id: number; file: File; target: UploadTarget; status: Status; progress: number; error?: string };
const UploadContext = createContext<{ enqueue: (files: File[], target: UploadTarget) => void; active: number }>({ enqueue: () => {}, active: 0 });
export const useUploads = () => useContext(UploadContext);
const CONCURRENCY = 2;
const extensions = new Set(Object.values(FILE_TYPES).flat() as string[]);
// Same limits the server enforces, checked first so obviously invalid files never leave the browser.
export function precheck(file: File) {
  if (!file.size || file.size > MAX_FILE_BYTES) return messageFor('FILE_SIZE_INVALID');
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!extensions.has(extension)) return messageFor('FILE_TYPE_INVALID');
  return null;
}
export const formatBytes = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export function UploadProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const counter = useRef(0);
  const requests = useRef(new Map<number, XMLHttpRequest>());
  const toast = useToast();
  const update = useCallback((id: number, patch: Partial<Item>) => setItems(current => current.map(item => item.id === id ? { ...item, ...patch } : item)), []);
  const enqueue = useCallback((files: File[], target: UploadTarget) => {
    if (!files.length) return;
    setCollapsed(false);
    setItems(current => [...current.filter(item => item.status !== 'done' && item.status !== 'cancelled'), ...files.map(file => { const error = precheck(file); return { id: ++counter.current, file, target, status: error ? 'error' as const : 'queued' as const, progress: 0, error: error ?? undefined }; })]);
  }, []);
  const start = useCallback((item: Item) => {
    const form = new FormData();
    form.set('file', item.file);
    if (item.target.folderId) form.set('folderId', item.target.folderId);
    if (item.target.clientId) form.set('clientId', item.target.clientId);
    else if (item.target.attachment) form.set(item.target.attachment.field, item.target.attachment.id);
    const xhr = new XMLHttpRequest();
    requests.current.set(item.id, xhr);
    xhr.open('POST', '/api/documents');
    xhr.responseType = 'json';
    xhr.upload.onprogress = event => { if (event.lengthComputable) update(item.id, { progress: Math.min(0.97, event.loaded / event.total) }); };
    xhr.onload = () => {
      requests.current.delete(item.id);
      if (xhr.status === 201) {
        update(item.id, { status: 'done', progress: 1 });
        window.dispatchEvent(new CustomEvent('aj:documents-changed', { detail: { folderId: item.target.folderId, clientId: item.target.clientId } }));
        return;
      }
      const code = (xhr.response as { error?: string } | null)?.error ?? 'SERVICE_UNAVAILABLE';
      signalSecurity(code);
      update(item.id, { status: 'error', error: messageFor(code) });
    };
    xhr.onerror = () => { requests.current.delete(item.id); update(item.id, { status: 'error', error: messageFor('NETWORK') }); };
    xhr.onabort = () => { requests.current.delete(item.id); update(item.id, { status: 'cancelled' }); };
    update(item.id, { status: 'uploading', progress: 0.02 });
    xhr.send(form);
  }, [update]);
  const uploading = items.filter(item => item.status === 'uploading').length;
  const queued = items.filter(item => item.status === 'queued');
  useEffect(() => { for (const item of queued.slice(0, Math.max(0, CONCURRENCY - uploading))) start(item); }, [queued, uploading, start]);
  const active = uploading + queued.length;
  // One summary toast when a batch finishes, so long uploads can run while the user keeps working.
  const wasActive = useRef(false);
  useEffect(() => {
    if (active) { wasActive.current = true; return; }
    if (!wasActive.current) return;
    wasActive.current = false;
    const done = items.filter(item => item.status === 'done').length, failed = items.filter(item => item.status === 'error').length;
    if (failed) toast({ kind: 'error', title: `${failed} archivo${failed === 1 ? '' : 's'} sin subir`, message: done ? `${done} se guardaron correctamente. Revisa el panel de cargas.` : 'Revisa el detalle en el panel de cargas.' });
    else if (done) toast({ kind: 'success', title: `${done} archivo${done === 1 ? '' : 's'} guardado${done === 1 ? '' : 's'}`, message: 'Ya están disponibles en la biblioteca privada.' });
  }, [active, items, toast]);
  useEffect(() => {
    if (!active) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [active]);
  const cancel = (item: Item) => { const xhr = requests.current.get(item.id); if (xhr) xhr.abort(); else update(item.id, { status: 'cancelled' }); };
  const retry = (item: Item) => update(item.id, { status: precheck(item.file) ? 'error' : 'queued', progress: 0, error: precheck(item.file) ?? undefined });
  const value = useMemo(() => ({ enqueue, active }), [enqueue, active]);
  return <UploadContext.Provider value={value}>{children}{items.length ? <UploadPanel items={items} active={active} collapsed={collapsed} onToggle={() => setCollapsed(value => !value)} onClose={() => setItems([])} onCancel={cancel} onRetry={retry}/> : null}</UploadContext.Provider>;
}

function UploadPanel({ items, active, collapsed, onToggle, onClose, onCancel, onRetry }: { items: Item[]; active: number; collapsed: boolean; onToggle: () => void; onClose: () => void; onCancel: (item: Item) => void; onRetry: (item: Item) => void }) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => { if (ref.current && !prefersReducedMotion()) gsap.fromTo(ref.current, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: 'expo.out', clearProps: 'transform' }); }, []);
  const done = items.filter(item => item.status === 'done').length, failed = items.filter(item => item.status === 'error').length;
  const progress = items.length ? items.reduce((sum, item) => sum + (item.status === 'done' ? 1 : item.progress), 0) / items.length : 0;
  const title = active ? `Subiendo ${active} archivo${active === 1 ? '' : 's'}` : failed ? `${failed} con error · ${done} guardado${done === 1 ? '' : 's'}` : `${done} archivo${done === 1 ? '' : 's'} guardado${done === 1 ? '' : 's'}`;
  const drag = useDrag({ axis: 'y', onMove: ({ dy }) => { if (ref.current && dy > 0 && !collapsed) gsap.set(ref.current, { y: dy }); }, onEnd: ({ dy }) => { if (ref.current) gsap.to(ref.current, { y: 0, duration: 0.25 }); if (dy > 60 && !collapsed) onToggle(); } });
  return <aside ref={ref} className={`upload-panel${collapsed ? ' is-collapsed' : ''}`} aria-label="Cargas de archivos">
    <header {...drag}><span className="upload-panel-icon" aria-hidden="true">{active ? <DocumentUpload/> : failed ? <Warning2/> : <TickCircle/>}</span><strong aria-live="polite">{title}</strong>
      <button type="button" className="icon-button" aria-label={collapsed ? 'Mostrar cargas' : 'Minimizar cargas'} aria-expanded={!collapsed} onClick={onToggle}>{collapsed ? <ArrowUp2/> : <ArrowDown2/>}</button>
      {!active ? <button type="button" className="icon-button" aria-label="Cerrar panel de cargas" onClick={onClose}><CloseCircle/></button> : null}
    </header>
    {active ? <div className="upload-total" aria-hidden="true"><i style={{ width: `${Math.round(progress * 100)}%` }}/></div> : null}
    {!collapsed ? <ul>{items.map(item => <li key={item.id} className={`upload-item is-${item.status}`}>
      <div className="upload-item-text"><span className="upload-name">{item.file.name}</span><small>{item.status === 'error' ? item.error : item.status === 'cancelled' ? 'Cancelado' : item.status === 'done' ? `Guardado en ${item.target.label}` : `${formatBytes(item.file.size)} · ${item.target.label}`}</small>
        {item.status === 'uploading' || item.status === 'queued' ? <div className="upload-bar" role="progressbar" aria-label={`Progreso de ${item.file.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(item.progress * 100)}><i style={{ width: `${Math.round(item.progress * 100)}%` }}/></div> : null}</div>
      {item.status === 'uploading' || item.status === 'queued' ? <button type="button" className="icon-button" aria-label={`Cancelar ${item.file.name}`} onClick={() => onCancel(item)}><CloseCircle/></button>
        : item.status === 'error' || item.status === 'cancelled' ? <button type="button" className="icon-button" aria-label={`Reintentar ${item.file.name}`} onClick={() => onRetry(item)}><ArrowRotateRight/></button>
        : <TickCircle className="upload-ok" aria-hidden="true"/>}
    </li>)}</ul> : null}
  </aside>;
}
