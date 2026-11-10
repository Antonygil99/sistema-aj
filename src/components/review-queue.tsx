'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {ArrowLeft,ArrowRight,Refresh2,SearchNormal1,ShieldSecurity,TickCircle} from '@/components/icons';
import {reviewKinds} from '@/modules/revision/types';
import type {reviewQueue} from '@/modules/revision/server';
import {apiFetch} from './ui/client-api';
import {Select} from './ui/select';
import './review-queue.css';
import {FeatureDiscovery,TourButton} from './feature-discovery';
type Data=Awaited<ReturnType<typeof reviewQueue>>;
export function ReviewQueue({initial}:{initial:Data}){
  const [data,setData]=useState(initial),[q,setQ]=useState(''),[kind,setKind]=useState<keyof typeof reviewKinds>('all'),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const controller=useRef<AbortController|null>(null);
  useEffect(()=>()=>controller.current?.abort(),[]);
  async function load(skip=0,nextKind=kind){
    controller.current?.abort();const c=new AbortController();controller.current=c;setBusy(true);setError('');
    try{const result=await apiFetch<Data>('/api/review?'+new URLSearchParams({q,kind:nextKind,skip:String(q!==data.query.q||nextKind!==data.query.kind?0:skip)}),{signal:c.signal});if(!c.signal.aborted)setData(result);}
    catch(e){if(!c.signal.aborted)setError((e as Error).message);}finally{if(!c.signal.aborted)setBusy(false);}
  }
  return <section className="review-queue" aria-label="Revisión de expedientes">
    <FeatureDiscovery feature="review"/><TourButton id="funcion:revision"/>
    <div className="review-intro"><span className="review-emblem"><ShieldSecurity aria-hidden="true"/></span><div><h2>Datos listos para trabajar</h2><p>Completa las asignaciones y revisa los calendarios antes de continuar. Una ausencia de recibos no significa que la póliza esté pagada.</p></div></div>
    <div className="review-counts">{(['catalog','policyOwner','productOwner','schedule','renewal'] as const).map(key=><button type="button" key={key} aria-pressed={kind===key} onClick={()=>{setKind(key);void load(0,key);}}><strong>{data.summary[key]}</strong><span>{reviewKinds[key]}</span></button>)}</div>
    <form className="resource-filters" onSubmit={e=>{e.preventDefault();void load();}}><label className="search-field"><SearchNormal1 aria-hidden="true"/><span className="sr-only">Buscar registro por revisar</span><input type="search" value={q} maxLength={100} onChange={e=>setQ(e.target.value)} placeholder="Cliente, póliza, producto o aseguradora"/></label><label><span className="sr-only">Tipo de revisión</span><Select value={kind} onChange={e=>setKind(e.target.value as typeof kind)}>{Object.entries(reviewKinds).map(([id,label])=><option key={id} value={id}>{label}</option>)}</Select></label><button className="button button-soft" disabled={busy}>Buscar</button><button type="button" className="text-button" disabled={busy} onClick={()=>void load(data.skip)} aria-label="Actualizar revisión"><Refresh2 aria-hidden="true"/></button></form>
    <p className="lead-small">{data.total} registro{data.total===1?'':'s'} en esta búsqueda. Los contadores superiores abarcan todo el equipo y pueden coincidir en una misma póliza.</p>
    {error?<p role="alert" className="form-error">{error}</p>:null}
    <div aria-busy={busy} className="review-list">{data.rows.map(row=><article key={row.entity+row.id} className="review-row"><div><small>{row.entity==='policy'?'Póliza':'Producto'}</small><h3>{row.title}</h3><p>{row.subtitle}</p><ul>{row.issues.map(issue=><li key={issue}>{issue}</li>)}</ul></div><Link className="button button-soft" href={row.href}>{row.action}<ArrowRight aria-hidden="true"/></Link></article>)}{!data.rows.length?<div className="review-empty"><TickCircle aria-hidden="true"/><h3>{data.total?'Sin registros en esta página':'Sin pendientes con estos filtros'}</h3><p>Puedes ajustar la búsqueda o actualizar después de completar un expediente.</p></div>:null}</div>
    <div className="resource-toolbar review-pagination"><span className="resource-count">{data.total?`${data.skip+1}–${Math.min(data.skip+data.rows.length,data.total)} de ${data.total}`:'0 registros'}</span><button type="button" className="text-button" disabled={busy||data.skip===0} onClick={()=>void load(Math.max(0,data.skip-data.take))}><ArrowLeft aria-hidden="true"/>Anterior</button><button type="button" className="text-button" disabled={busy||data.skip+data.take>=data.total} onClick={()=>void load(data.skip+data.take)}>Siguiente<ArrowRight aria-hidden="true"/></button></div>
  </section>;
}
