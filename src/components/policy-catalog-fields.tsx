'use client';
import {useEffect,useId,useRef,useState} from 'react';
import Link from 'next/link';
import {RelationPicker} from './ui/relation-picker';
import {apiFetch} from './ui/client-api';
import {insurerKey} from '@/modules/aseguradoras/identity';
import {productLineLabels,type Row} from '@/modules/resources/config';
import {SearchNormal1} from './icons';
import './policy-catalog-fields.css';
type Values={insurer:string;product:string;productId:string;ownerEmail?:string};
type Company={id:string;name:string};
export function PolicyCatalogFields({values,label,onChange,disabled=false,error}:{values:Values;label?:string;onChange:(patch:Partial<Values>,label?:string)=>void;disabled?:boolean;error?:string}){
 const [companies,setCompanies]=useState<Company[]>([]),[failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0);
 const [manual,setManual]=useState(false),[query,setQuery]=useState(''),[open,setOpen]=useState(false),[active,setActive]=useState(0),[line,setLine]=useState('');
 const box=useRef<HTMLDivElement>(null),uid=useId();
 useEffect(()=>{const controller=new AbortController();apiFetch<{data:Company[]}>('/api/insurers',{signal:controller.signal}).then(r=>{if(!controller.signal.aborted){setCompanies(r.data);setFailed(false);}}).catch(()=>{if(!controller.signal.aborted)setFailed(true);});return()=>controller.abort();},[attempt]);
 useEffect(()=>{if(!open)return;const close=(e:PointerEvent)=>{if(!box.current?.contains(e.target as Node))setOpen(false);};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);},[open]);
 const company=companies.find(c=>insurerKey(c.name)===insurerKey(values.insurer));
 const matches=companies.filter(c=>insurerKey(c.name).includes(insurerKey(query)));
 function choose(c:Company){setOpen(false);setQuery('');setLine('');if(insurerKey(c.name)!==insurerKey(values.insurer))onChange({insurer:c.name,productId:'',product:'',ownerEmail:''},'');else onChange({insurer:c.name});}
 function product(id:string,text:string,row?:Row){setManual(false);setLine(String(row?.line??''));onChange({productId:id,...(row?{insurer:String(row.insurer),product:String(row.name),ownerEmail:typeof row.ownerEmail==='string'?row.ownerEmail:''}:{})},text);}
 return <div className="policy-catalog-fields is-wide">
  <div className="policy-catalog-grid"><div className="form-field"><span className="form-label">Aseguradora *</span>{manual?<input aria-label="Aseguradora" value={values.insurer} maxLength={250} disabled={disabled} required onChange={e=>onChange({insurer:e.target.value})}/>:<div className="relation-picker" ref={box} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setOpen(false);}}>
   <SearchNormal1 aria-hidden="true"/><input role="combobox" aria-label="Aseguradora" aria-controls={uid} aria-expanded={open} aria-autocomplete="list" aria-activedescendant={open&&matches[active]?uid+'-'+active:undefined} placeholder="Buscar aseguradora…" value={open?query:values.insurer} disabled={disabled} autoComplete="off" onFocus={()=>{setOpen(true);setQuery('');}} onChange={e=>{setQuery(e.target.value);setActive(0);setOpen(true);}} onKeyDown={e=>{if(e.key==='ArrowDown'){e.preventDefault();setOpen(true);setActive(i=>Math.min(matches.length-1,i+1));}if(e.key==='ArrowUp'){e.preventDefault();setActive(i=>Math.max(0,i-1));}if(e.key==='Enter'&&open){e.preventDefault();if(matches[active])choose(matches[active]);}if(e.key==='Escape'){e.stopPropagation();setOpen(false);}}}/>
   {open?<ul className="relation-options" id={uid} role="listbox" aria-label="Aseguradoras">{matches.map((c,i)=><li key={c.id} id={uid+'-'+i} role="option" aria-selected={i===active} className={i===active?'is-active':''} onPointerDown={e=>{e.preventDefault();choose(c);}}>{c.name}</li>)}{!matches.length?<li className="relation-hint">{failed?'No se pudo cargar el catálogo.':'Sin coincidencias. Puedes capturar los datos de la carátula.'}</li>:null}</ul>:null}
  </div>}{failed?<small role="alert">No se pudo cargar el catálogo. <button type="button" onClick={()=>setAttempt(v=>v+1)}>Reintentar</button></small>:null}</div>
  <div className="form-field"><span className="form-label">Producto *</span><RelationPicker key={company?.id??values.insurer} relation="productos" value={values.productId} initialLabel={label||values.product} label="Producto" insurerId={company?.id} disabled={disabled} required={!manual&&!values.product} onChange={product}/><small className="form-hint">{company?'Productos de '+company.name+'.':'Busca en todo el catálogo o elige primero una aseguradora.'}</small></div></div>
  {values.productId?<p className="policy-catalog-summary">{line?productLineLabels[line as keyof typeof productLineLabels]+' · ':''}Datos vinculados al catálogo. El responsable se completa al elegir el producto.</p>:values.product&&!manual?<p className="policy-catalog-summary">Datos actuales de la carátula: <strong>{values.product}</strong>. Aún no está vinculado al catálogo.</p>:null}
  <div className="policy-catalog-actions"><button type="button" className="text-button" disabled={disabled} aria-expanded={manual} onClick={()=>{if(!manual){onChange({productId:''},'');setLine('');}setManual(v=>!v);}}>{manual?'Volver al catálogo':'Capturar datos de la carátula'}</button><Link className="text-button" href="/crm/productos" target="_blank">Administrar catálogo ↗</Link></div>
  {manual?<label className="form-field"><span className="form-label">Producto según la carátula *</span><input aria-label="Producto según la carátula" required maxLength={250} disabled={disabled} value={values.product} onChange={e=>onChange({product:e.target.value})}/><small className="form-hint">Úsalo si el producto todavía no existe en el catálogo. Podrás vincularlo después.</small></label>:null}
  {error?<p className="field-error" role="alert">{error}</p>:null}
 </div>;
}
