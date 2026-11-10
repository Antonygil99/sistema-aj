'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { CloseCircle, SearchNormal1 } from '@/components/icons';
import { relationLabel, type RelationSlug, type Row } from '@/modules/resources/config';
import { apiFetch } from './client-api';
// Searchable combobox over another CRM table (clients, policies, prospects, claims).
export function RelationPicker({ relation, value, initialLabel, onChange, label, required, disabled, insurerId,line }: { relation: RelationSlug; value: string; initialLabel: string; onChange: (id: string, label: string, row?: Row) => void; label: string; required?: boolean; disabled?: boolean; insurerId?:string;line?:string }) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<{ id: string; label: string; row: Row }[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [selection, setSelection] = useState({id:value,label:initialLabel});
  const [failed,setFailed]=useState(false),[more,setMore]=useState(false);
  const [loading, setLoading] = useState(false);
  const listId = useId();
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setFailed(false);
      try {
        const result = await apiFetch<{ data: Row[];total?:number }>(`/api/crm/${relation}?take=20&q=${encodeURIComponent(query.trim())}${insurerId?'&insurerId='+encodeURIComponent(insurerId):''}${line?'&line='+encodeURIComponent(line):''}`, { signal: controller.signal });
        if(controller.signal.aborted)return;
        setOptions(result.data.map(row => ({ id: row.id, label: relationLabel[relation](row) || row.id, row })));
        setMore((result.total??0)>result.data.length);
        setActive(0);
      } catch { if (!controller.signal.aborted){setOptions([]);setFailed(true);} }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 180);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [open, query, relation, insurerId,line]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!box.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  function choose(option: { id: string; label: string; row: Row }) { setSelection({id:option.id,label:option.label}); onChange(option.id, option.label, option.row); setQuery(''); setOpen(false); }
  if (value && !open) return <div className="relation-selected"><span>{(selection.id===value?selection.label:initialLabel) || 'Registro vinculado'}</span>{!disabled ? <><button type="button" className="text-button" aria-label={`Cambiar ${label}`} onClick={()=>setOpen(true)}>Cambiar</button><button type="button" className="icon-button" aria-label={`Quitar ${label}`} onClick={() => { onChange('', ''); setSelection({id:'',label:''}); }}><CloseCircle aria-hidden="true"/></button></> : null}</div>;
  return <div className="relation-picker" ref={box}>
    <SearchNormal1 aria-hidden="true"/>
    <input ref={input} role="combobox" aria-label={label} aria-expanded={open} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined}
      value={query} placeholder="Buscar…" required={required && !value} disabled={disabled} autoComplete="off"
      onFocus={() => setOpen(true)} onChange={event => { setQuery(event.target.value); setOpen(true); }}
      onKeyDown={event => {
        if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); setActive(index => Math.min(options.length - 1, index + 1)); }
        else if (event.key === 'ArrowUp') { event.preventDefault(); setActive(index => Math.max(0, index - 1)); }
        else if (event.key === 'Enter' && open && options[active]) { event.preventDefault(); choose(options[active]); }
        else if (event.key === 'Escape' && open) { event.stopPropagation(); setOpen(false); }
      }}/>
    {open ? <ul id={listId} role="listbox" className="relation-options">{loading && !options.length ? <li className="relation-hint">Buscando…</li> : null}{!loading && !options.length ? <li className="relation-hint">{failed?'No se pudo consultar. Escribe para reintentar.':'Sin coincidencias'}</li> : null}
      {options.map((option, index) => <li key={option.id} id={`${listId}-${index}`} role="option" aria-selected={index === active} className={index === active ? 'is-active' : ''} onPointerDown={event => { event.preventDefault(); choose(option); }}>{option.label}</li>)}{more?<li className="relation-hint">Hay más resultados. Escribe para afinar la búsqueda.</li>:null}</ul> : null}
  </div>;
}
