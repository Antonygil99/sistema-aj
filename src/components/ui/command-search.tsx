'use client';
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Card, CloseCircle, Clock, DocumentText, DocumentUpload, Folder2, FolderAdd, Refresh2, SearchNormal1, Send2, UserOctagon } from 'iconsax-reactjs';
import { groupResults, kindLabels, type SearchKind, type SearchResult } from '@/modules/search';
import { moduleIcons } from '../module-icons';
import { apiFetch } from './client-api';
import { portalTarget } from './modal';
import { gsap, prefersReducedMotion } from './motion';
type Role = 'USER' | 'ADMIN' | 'SUPERADMIN';
type Item = { key: string; title: string; subtitle: string; href: string; download?: boolean; kind: SearchKind | 'accion' | 'reciente'; tag: string; icon: ReactNode };
const RECENT_KEY = 'aj:search-recent';
const tones: Record<string, string> = { clientes: 'mint', polizas: 'blue', prospectos: 'lilac', documentos: 'sand', carpetas: 'sand', pagos: 'mint', renovaciones: 'blue', siniestros: 'red', cotizaciones: 'lilac', actividades: 'sand', usuarios: 'neutral', accion: 'neutral', reciente: 'neutral' };
function kindIcon(kind: SearchKind) {
  if (kind === 'documentos') return <DocumentText aria-hidden="true"/>;
  if (kind === 'carpetas') return <Folder2 aria-hidden="true"/>;
  if (kind === 'usuarios') return <UserOctagon aria-hidden="true"/>;
  const Icon = moduleIcons[kind];
  return <Icon aria-hidden="true"/>;
}
function useDebounce<T>(value: T, delay = 200) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => { const timer = setTimeout(() => setDebounced(value), delay); return () => clearTimeout(timer); }, [value, delay]);
  return debounced;
}
const readRecent = (): Item[] => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as Item[]; } catch { return []; } };
// Global CRM search (⌘K / Ctrl+K): records, files, folders and — for the superadmin — access grants.
export function CommandSearch({ role }: { role: Role }) {
  const [open, setOpen] = useState(false);
  const [rendered, setRendered] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  if (open && !rendered) setRendered(true);
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setOpen(value => !value); }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  const target = rendered ? portalTarget() : null;
  return <>
    <button ref={trigger} type="button" className="search-trigger" aria-label="Buscar en el CRM (Ctrl+K)" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}><SearchNormal1 aria-hidden="true"/></button>
    {target && rendered ? createPortal(<SearchPalette role={role} open={open} onClose={() => setOpen(false)} onClosed={() => { setRendered(false); trigger.current?.focus({ preventScroll: true }); }}/>, target) : null}
  </>;
}

function SearchPalette({ role, open, onClose, onClosed }: { role: Role; open: boolean; onClose: () => void; onClosed: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searched, setSearched] = useState('');
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<Item[]>(() => typeof window === 'undefined' ? [] : readRecent());
  const debounced = useDebounce(query.trim(), 200);
  const panel = useRef<HTMLDivElement>(null), backdrop = useRef<HTMLDivElement>(null), list = useRef<HTMLDivElement>(null), input = useRef<HTMLInputElement>(null), iconBox = useRef<HTMLSpanElement>(null);
  const listId = useId();
  // Only rendered after a click or shortcut, so reading the platform here cannot cause a hydration mismatch.
  const [modifier] = useState(() => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘' : 'Ctrl');
  const typing = query.trim().length > 0;
  // Panel enters from the top; on close it reverses before unmounting.
  useLayoutEffect(() => {
    const el = panel.current, shade = backdrop.current;
    if (!el || !shade) return;
    if (open) {
      gsap.fromTo(shade, { opacity: 0 }, { opacity: 1, duration: 0.22 });
      if (prefersReducedMotion()) gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.15 });
      else gsap.fromTo(el, { opacity: 0, y: -18, scale: 0.98 }, { opacity: 1, y: 0, scale: 1, duration: 0.42, ease: 'expo.out', clearProps: 'transform' });
      requestAnimationFrame(() => input.current?.focus({ preventScroll: true }));
      const previous = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = previous; };
    }
    gsap.to(shade, { opacity: 0, duration: 0.18 });
    gsap.to(el, { opacity: 0, y: -10, scale: 0.98, duration: 0.18, ease: 'power2.in', onComplete: onClosed });
  }, [open, onClosed]);
  // Search icon turns into "send" while typing (the reference component's icon swap).
  useLayoutEffect(() => {
    if (iconBox.current && !prefersReducedMotion()) gsap.fromTo(iconBox.current.firstElementChild, { y: -14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.2 });
  }, [typing]);
  useEffect(() => {
    if (debounced.length < 2) return;
    const controller = new AbortController();
    void (async () => {
      setLoading(true); setFailed(false);
      try {
        const data = await apiFetch<{ q: string; results: SearchResult[] }>(`/api/search?q=${encodeURIComponent(debounced)}`, { signal: controller.signal });
        setResults(data.results); setSearched(data.q); setActive(0);
      } catch { if (!controller.signal.aborted) { setFailed(true); setResults([]); } }
      finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [debounced]);
  const actions = useMemo<Item[]>(() => [
    ...(role !== 'USER' ? [{ key: 'a-expediente', title: 'Nuevo expediente', subtitle: 'Cliente, póliza y calendario de recibos', href: '/crm/clientes/nuevo', icon: <FolderAdd aria-hidden="true"/> }] : []),
    { key: 'a-archivos', title: 'Subir o buscar archivos', subtitle: 'Biblioteca privada del equipo', href: '/crm/documentos', icon: <DocumentUpload aria-hidden="true"/> },
    { key: 'a-pagos', title: 'Recibos y cobranza', subtitle: 'Pendientes, vencidos y pagados', href: '/crm/pagos', icon: <Card aria-hidden="true"/> },
    { key: 'a-renovaciones', title: 'Renovaciones próximas', subtitle: 'Continuidad de la cartera', href: '/crm/renovaciones', icon: <Refresh2 aria-hidden="true"/> },
    ...(role === 'SUPERADMIN' ? [{ key: 'a-usuarios', title: 'Usuarios y accesos', subtitle: 'Quién puede entrar al CRM', href: '/usuarios', icon: <UserOctagon aria-hidden="true"/> }] : []),
  ].map(item => ({ ...item, kind: 'accion' as const, tag: 'Acción' })), [role]);
  const showResults = debounced.length >= 2 && searched === debounced;
  const groups = useMemo(() => {
    if (!typing || debounced.length < 2) return [...(recent.length ? [{ label: 'Recientes', items: recent.map(item => ({ ...item, kind: 'reciente' as const, icon: <Clock aria-hidden="true"/> })) }] : []), { label: 'Acciones rápidas', items: actions }];
    if (!showResults) return [];
    return groupResults(results).map(group => ({ label: group.label, items: group.items.map(result => ({ key: `${result.kind}-${result.id}`, title: result.title, subtitle: result.subtitle, href: result.href, download: result.download, kind: result.kind, tag: kindLabels[result.kind], icon: kindIcon(result.kind) })) }));
  }, [typing, debounced, showResults, results, recent, actions]);
  const flat = groups.flatMap(group => group.items);
  // Results enter staggered, like the reference component's list.
  useLayoutEffect(() => {
    if (!list.current || prefersReducedMotion()) return;
    gsap.fromTo(list.current.querySelectorAll('[role=option], .search-group-label'), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.28, stagger: 0.025, clearProps: 'transform' });
  }, [groups]);
  const choose = useCallback((item: Item) => {
    if (item.kind !== 'accion' && item.kind !== 'reciente') {
      const entry = { key: item.key, title: item.title, subtitle: item.subtitle, href: item.href, download: item.download, kind: item.kind, tag: item.tag } as Item;
      const next = [entry, ...readRecent().filter(previous => previous.key !== item.key)].slice(0, 5);
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* private mode */ }
      setRecent(next);
    }
    onClose();
    if (item.download) window.location.assign(item.href);
    else router.push(item.href);
  }, [onClose, router]);
  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape') { event.preventDefault(); onClose(); }
    else if (event.key === 'ArrowDown') { event.preventDefault(); setActive(index => Math.min(flat.length - 1, index + 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive(index => Math.max(0, index - 1)); }
    else if (event.key === 'Enter' && flat[active]) { event.preventDefault(); choose(flat[active]); }
    else if (event.key === 'Tab') event.preventDefault();
  }
  useEffect(() => { list.current?.querySelector(`#${CSS.escape(`${listId}-${active}`)}`)?.scrollIntoView({ block: 'nearest' }); }, [active, listId]);
  let index = -1;
  return <div className="search-root" onKeyDown={onKeyDown}>
    <div ref={backdrop} className="modal-backdrop" onClick={onClose}/>
    <div ref={panel} className="search-panel" role="dialog" aria-modal="true" aria-label="Buscar en el CRM">
      <div className="search-label-row"><label className="search-label" htmlFor={`${listId}-input`}>Buscar en el CRM</label><button type="button" className="search-close" aria-label="Cerrar buscador" onClick={onClose}><CloseCircle aria-hidden="true"/></button></div>
      <div className="search-input">
        <input ref={input} id={`${listId}-input`} type="text" role="combobox" aria-expanded="true" aria-controls={listId} aria-autocomplete="list" aria-activedescendant={flat[active] ? `${listId}-${active}` : undefined}
          value={query} maxLength={100} autoComplete="off" spellCheck={false} placeholder="¿Qué buscas? Clientes, pólizas, archivos, recibos…" onChange={event => { setQuery(event.target.value); setActive(0); }}/>
        <span ref={iconBox} className="search-input-icon" aria-hidden="true">{typing ? <Send2 key="send"/> : <SearchNormal1 key="search"/>}</span>
      </div>
      <div ref={list} id={listId} role="listbox" aria-label="Resultados" className="search-results" aria-busy={loading}>
        {groups.map(group => <div key={group.label} role="group" aria-label={group.label}><p className="search-group-label">{group.label}</p>
          {group.items.map(item => { index++; const position = index; return <div key={item.key} id={`${listId}-${position}`} role="option" aria-selected={position === active} className={`search-item${position === active ? ' is-active' : ''}`}
            onPointerMove={() => setActive(position)} onClick={() => choose(item)}>
            <span className={`search-item-icon tone-${tones[item.kind] ?? 'neutral'}`}>{item.icon}</span>
            <span className="search-item-text"><strong>{item.title}</strong>{item.subtitle ? <small>{item.subtitle}</small> : null}</span>
            <span className="search-item-end">{position === active ? <kbd>↵</kbd> : null}<span>{item.tag}</span></span>
          </div>; })}
        </div>)}
        {typing && debounced.length < 2 ? <p className="search-hint">Escribe al menos 2 letras.</p> : null}
        {typing && debounced.length >= 2 && !showResults && loading ? <p className="search-hint">Buscando…</p> : null}
        {failed ? <p className="search-hint">No se pudo buscar. Revisa tu conexión e inténtalo de nuevo.</p> : null}
        {showResults && !flat.length && !failed ? <div className="search-empty"><strong>Sin resultados para «{searched}»</strong><small>Prueba con un nombre, número de póliza, correo o referencia.</small></div> : null}
      </div>
      <div className="search-footer"><span><kbd>{modifier}</kbd><kbd>K</kbd> abrir</span><span><kbd>↑</kbd><kbd>↓</kbd> moverte</span><span><kbd>↵</kbd> abrir</span><span><kbd>Esc</kbd> cerrar</span></div>
    </div>
  </div>;
}
