'use client';
import {useId,useRef,useState} from 'react';
import {Add,Trash,TickCircle} from '@/components/icons';
import {frequencies,makeSchedule,scheduleIssues} from '@/modules/polizas/finance';
import {apiFetch} from './ui/client-api';
import {Modal} from './ui/modal';
import {Select} from './ui/select';
import {useConfirm} from './ui/confirm';
import {useToast} from './ui/toast';
import './policy-schedule-editor.css';
type Policy={id:string;number:string;premium:string;currency:string;startDate:string;endDate:string;updatedAt:string;paymentFrequency:string|null;payments:{id:string;amount:string;dueDate:string;status:string}[]};
type Draft={key:string;id?:string;amount:string;dueDate:string;paid:boolean};
export function PolicyScheduleEditor({policy,version,hasHistory,onClose,onSaved}:{policy:Policy;version:string;hasHistory:boolean;onClose:()=>void;onSaved:()=>Promise<unknown>}){
  const confirm=useConfirm(),toast=useToast(),pending=useRef(false),formId=useId();
  const [rows,setRows]=useState<Draft[]>(()=>policy.payments.map(row=>({key:row.id,id:row.id,amount:row.amount,dueDate:row.dueDate.slice(0,10),paid:row.status==='PAID'})));
  const [frequency,setFrequency]=useState(policy.paymentFrequency??''),[count,setCount]=useState(Math.max(1,policy.payments.length)),[first,setFirst]=useState(policy.startDate.slice(0,10));
  const [reviewed,setReviewed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [snapshot]=useState(()=>JSON.stringify({rows,frequency}));
  const dirty=snapshot!==JSON.stringify({rows,frequency});
  const paid=rows.some(row=>row.paid),removed=policy.payments.filter(old=>!rows.some(row=>row.id===old.id));
  const issue=scheduleIssues({premium:Number(policy.premium),startDate:policy.startDate.slice(0,10),endDate:policy.endDate.slice(0,10)},rows.map(row=>({amount:Number(row.amount),dueDate:row.dueDate})),frequency);
  function update(index:number,patch:Partial<Draft>){setRows(current=>current.map((row,i)=>i===index?{...row,...patch}:row));setReviewed(false);}
  async function close(){if(busy)return;if(dirty&&!await confirm({title:'Descartar propuesta de calendario',message:'Los cambios del calendario aún no se guardaron.',confirmLabel:'Descartar propuesta',cancelLabel:'Seguir revisando',tone:'danger'}))return;onClose();}
  async function generate(){
    if(rows.length&&!await confirm({title:'Reemplazar la propuesta',message:'Se reemplazarán las fechas e importes de este borrador. Los recibos guardados se conservarán hasta que revises y guardes el calendario completo.',confirmLabel:'Generar propuesta',cancelLabel:'Conservar borrador'}))return;
    setRows(makeSchedule(Number(policy.premium),frequency==='ONCE'?1:count,first,frequency as keyof typeof frequencies).map(row=>({key:crypto.randomUUID(),amount:String(row.amount),dueDate:row.dueDate,paid:false})));setReviewed(false);
  }
  async function save(){
    if(pending.current||issue||!reviewed||!frequency)return;pending.current=true;setBusy(true);setError('');
    try{
      const editing=hasHistory||policy.payments.length>0;
      await apiFetch(`/api/policies/${policy.id}/schedule`,{method:editing?'PATCH':'POST',json:{expectedUpdatedAt:policy.updatedAt,...(editing?{expectedScheduleVersion:version}:{}),paymentFrequency:frequency,payments:rows.map(row=>({...((editing&&row.id)?{id:row.id}:{}),amount:Number(row.amount),dueDate:row.dueDate})),reviewed}});
      try{await onSaved();toast({kind:'success',title:'Calendario guardado'});}catch{toast({kind:'warning',title:'Calendario guardado',message:'Actualiza la página para consultar los cambios.'});}
      onClose();
    }catch(e){setError((e as Error).message);}finally{pending.current=false;setBusy(false);}
  }
  return <Modal open onClose={()=>void close()} title={policy.payments.length?'Ajustar calendario de recibos':'Preparar calendario de recibos'} description={`Póliza ${policy.number} · ${policy.currency}`} busy={busy} size="lg" footer={<><span className="modal-footer-spacer"/><button type="button" className="text-button" disabled={busy} onClick={()=>void close()}>Cancelar</button><button type="submit" form={formId} className="button" disabled={busy||!!issue||!reviewed||!frequency}><TickCircle aria-hidden="true"/>{busy?'Guardando…':'Guardar calendario'}</button></>}>
    <form id={formId} className="schedule-editor" onSubmit={e=>{e.preventDefault();void save();}}>
      <p>Compara cada recibo con la documentación de la aseguradora. Los pagos confirmados conservan fecha, importe, referencia y comprobante.</p>
      <div className="schedule-editor-controls"><label>Periodicidad<Select value={frequency} onChange={e=>{setFrequency(e.target.value);if(e.target.value==='ONCE')setCount(1);setReviewed(false);}}><option value="">Selecciona la periodicidad</option>{Object.entries(frequencies).map(([id,label])=><option key={id} value={id}>{label}</option>)}</Select></label>{!paid?<><label>Número de recibos<input type="number" min="1" max="120" disabled={frequency==='ONCE'} value={frequency==='ONCE'?1:count} onChange={e=>setCount(Number(e.target.value))}/></label><label>Primer vencimiento<input type="date" value={first} min={policy.startDate.slice(0,10)} max={policy.endDate.slice(0,10)} onChange={e=>setFirst(e.target.value)}/></label></>:null}</div>
      {!paid?<button type="button" className="text-button" disabled={busy||!frequency||!first||!Number.isInteger(count)||count<1||count>120} onClick={()=>void generate()}>Generar propuesta</button>:<p className="form-hint">Ajusta los pendientes de forma individual. La generación automática se desactiva cuando hay pagos confirmados.</p>}
      <div className="schedule-editor-rows">{rows.map((row,i)=><div className="schedule-editor-row" key={row.key}><div><strong>Recibo {i+1}</strong>{row.paid?<small>Pago confirmado</small>:null}</div><label>Vencimiento<input type="date" value={row.dueDate} disabled={busy||row.paid} min={policy.startDate.slice(0,10)} max={policy.endDate.slice(0,10)} required onChange={e=>update(i,{dueDate:e.target.value})}/></label><label>Importe ({policy.currency})<input inputMode="decimal" value={row.amount} disabled={busy||row.paid} required onChange={e=>update(i,{amount:e.target.value})}/></label><button type="button" className="text-button" disabled={busy||row.paid} aria-label={`Quitar recibo ${i+1} de la propuesta`} onClick={()=>{setRows(current=>current.filter((_,j)=>j!==i));setReviewed(false);}}><Trash aria-hidden="true"/></button></div>)}</div>
      <button type="button" className="text-button" disabled={busy||rows.length>=120} onClick={()=>{setRows(current=>[...current,{key:crypto.randomUUID(),amount:'',dueDate:'',paid:false}]);setReviewed(false);}}><Add aria-hidden="true"/>Añadir recibo</button>
      <div className="schedule-editor-total"><span>Total propuesto <strong>{(rows.reduce((sum,row)=>sum+Math.round((Number(row.amount)||0)*100),0)/100).toFixed(2)} {policy.currency}</strong></span><span>Prima contractual <strong>{Number(policy.premium).toFixed(2)} {policy.currency}</strong></span></div>
      {removed.length?<p className="notice">Al guardar se archivarán {removed.length} recibos pendientes que quitaste de la propuesta. Su historial se conserva.</p>:null}
      {issue?<p role="status" className="notice">{issue}</p>:null}{error?<p role="alert" className="form-error">{error}</p>:null}
      <label className="check-line"><input type="checkbox" checked={reviewed} disabled={busy} onChange={e=>setReviewed(e.target.checked)}/>Revisé fechas, importes y periodicidad contra los recibos de la aseguradora.</label>
    </form>
  </Modal>;
}
