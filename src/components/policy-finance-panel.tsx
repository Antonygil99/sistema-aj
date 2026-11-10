'use client';
import {DriveFiles} from './drive-files';
import {Select} from '@/components/ui/select';

import {TickCircle} from '@/components/icons';

import { FeatureDiscovery,TourButton } from './feature-discovery';
import {RenewalPreparationPanel} from './renewal-preparation';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from './ui/client-api';
import {PolicyScheduleEditor} from './policy-schedule-editor';
import { Modal } from './ui/modal';
type Payment = { id:string; amount:string; currency:string; dueDate:string; paidAt:string|null; status:string; updatedAt:string; reference:string|null; evidenceDriveLink?:{id:string;name:string}|null; evidenceDocument:{id:string;name:string;archivedAt:string|null}|null };
type Term = {id:string;number:string;startDate:string;endDate:string};
type Data = {scheduleVersion:string;hasPaymentHistory:boolean;driveError?:string|null;policy:Term & {premium:string;currency:string;paymentFrequency:string|null;clientId:string;updatedAt:string;status:string;payments:Payment[];previousPolicy:Term|null;nextPolicy:Term|null};evidence:{id:string;name:string}[];today:string};
const day = (value:string) => value.slice(0,10);
export function PolicyFinancePanel({policyId,canEdit}:{policyId:string;canEdit:boolean}) {
  const router=useRouter(),pending=useRef(false);
  const panel = useRef<HTMLDetailsElement>(null);
  const [targetPayment, setTargetPayment] = useState('');
  useEffect(() => {
    if (window.location.hash !== `#pagos-${encodeURIComponent(policyId)}` || !panel.current) return;
    setTargetPayment(new URLSearchParams(window.location.search).get('recibo') ?? '');
    panel.current.open = true;
  }, [policyId]);
  const [data,setData]=useState<Data|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[open,setOpen]=useState(false);
  const [scheduleEdit,setScheduleEdit]=useState(false),[reviewed,setReviewed]=useState(false);
  const [payment,setPayment]=useState<Payment|null>(null),[paidAt,setPaidAt]=useState(''),[reference,setReference]=useState(''),[documentId,setDocumentId]=useState('');
  const [drivePicker,setDrivePicker]=useState(false);
  const [renew,setRenew]=useState(false),[next,setNext]=useState({number:'',premium:'',startDate:'',endDate:''});
  const load=useCallback(async()=>{const result=await apiFetch<Data>(`/api/policies/${policyId}/finance`);setData(result);return result;},[policyId]);
  useEffect(() => {
    if (!data || !targetPayment || !data.policy.payments.some(item => item.id === targetPayment)) return;
    const row = document.getElementById(`recibo-${targetPayment}`);
    row?.focus({ preventScroll: true });
    row?.scrollIntoView({ block: 'center', behavior: 'instant' });
  }, [data, targetPayment]);
  async function toggle(value:boolean){setOpen(value);if(!value||data)return;setError('');setBusy(true);try{await load();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function save(kind:'payment'|'renew'){
    if(!data||pending.current)return;pending.current=true;setBusy(true);setError('');
    try{
      if(kind==='payment'&&payment)await apiFetch(`/api/payments/${payment.id}/confirm`,{method:'POST',json:{expectedUpdatedAt:payment.updatedAt,paidAt,reference,evidenceDocumentId:documentId,reviewed}});
      if(kind==='renew')await apiFetch(`/api/policies/${policyId}/renew`,{method:'POST',json:{...next,premium:Number(next.premium),expectedUpdatedAt:data.policy.updatedAt,reviewed}});
      setPayment(null);setRenew(false);setReviewed(false);await load();router.refresh();
    }catch(e){setError((e as Error).message);}finally{pending.current=false;setBusy(false);}
  }
  const policy=data?.policy;
  const sums=policy?{paid:policy.payments.filter(p=>p.status==='PAID').reduce((s,p)=>s+Number(p.amount),0),pending:policy.payments.filter(p=>p.status!=='PAID').reduce((s,p)=>s+Number(p.amount),0)}:null;
  return <details ref={panel} id={`pagos-${policyId}`} className="finance-panel" open={open} onToggle={event=>void toggle(event.currentTarget.open)}><summary>Recibos, pagos y renovación</summary><TourButton id="funcion:finanzas">Cómo usar pagos y renovaciones</TourButton>{open?<RenewalPreparationPanel policyId={policyId} canEdit={canEdit}/>:null}
    {error&&!payment&&!renew?<p role="alert" className="notice">{error}</p>:null}{busy&&!data?<p role="status">Consultando calendario…</p>:null}
    {policy&&data?<>{canEdit?<FeatureDiscovery feature="schedule"/>:null}<div className="finance-summary"><span>Prima de esta vigencia <strong>{Number(policy.premium).toFixed(2)} {policy.currency}</strong></span><span>Pagos confirmados <strong>{sums!.paid.toFixed(2)} {policy.currency}</strong></span><span>Recibos sin confirmar <strong>{policy.payments.length?sums!.pending.toFixed(2)+' '+policy.currency:'Sin calendario'}</strong></span></div>
      {policy.previousPolicy?<p>Vigencia anterior: <strong>{day(policy.previousPolicy.startDate)} a {day(policy.previousPolicy.endDate)}</strong> · póliza {policy.previousPolicy.number}</p>:null}
      {policy.nextPolicy?<p className="notice">Renovación vinculada: póliza {policy.nextPolicy.number} · {day(policy.nextPolicy.startDate)} a {day(policy.nextPolicy.endDate)}. Se conserva esta vigencia en el historial.</p>:null}
      {policy.payments.length?<div className="table-wrap"><table><caption>Calendario de esta vigencia</caption><thead><tr><th>Recibo</th><th>Vencimiento</th><th>Importe</th><th>Estado y evidencia</th><th>Acción</th></tr></thead><tbody>{policy.payments.map((p,i)=><tr key={p.id} id={`recibo-${p.id}`} tabIndex={targetPayment===p.id?-1:undefined} className={targetPayment===p.id?'finance-target-receipt':undefined}><td>{i+1}{targetPayment===p.id?<small className="finance-target-label">Recibo seleccionado</small>:null}</td><td>{day(p.dueDate)}</td><td>{Number(p.amount).toFixed(2)} {p.currency}</td><td>{p.status==='PAID'?<>Pagado {p.paidAt?day(p.paidAt):''}<br/>{p.reference||'Sin referencia histórica'}{p.evidenceDocument?<><br/><a href={`/api/documents/${p.evidenceDocument.id}/download`}>{p.evidenceDocument.name}</a></>:<small> · Sin evidencia histórica</small>}</>:day(p.dueDate)<data.today?'Vencido':'Pendiente'}</td><td>{canEdit&&policy.status!=='CANCELLED'&&p.status!=='PAID'?<button type="button" className="text-button" disabled={busy} onClick={()=>{setPayment(p);setPaidAt(data.today);setReference('');setDocumentId('');setReviewed(false);}}><TickCircle aria-hidden="true"/>Confirmar pago</button>:null}</td></tr>)}</tbody></table></div>:<p className="notice">Sin calendario conciliado: no significa que esté pagada ni que no tenga deuda.</p>}
      {canEdit&&policy.status!=='CANCELLED'?<button type="button" className="button button-soft" disabled={busy||policy.currency==='UDI'} onClick={()=>setScheduleEdit(true)}>{policy.payments.length?'Ajustar calendario completo':'Preparar calendario de recibos'}</button>:null}
      {policy.currency==='UDI'?<p className="notice">Esta vigencia requiere revisión separada de UDI. No se convierte automáticamente a pesos.</p>:null}
      {scheduleEdit?<PolicyScheduleEditor policy={policy} version={data.scheduleVersion} hasHistory={data.hasPaymentHistory} onClose={()=>setScheduleEdit(false)} onSaved={async()=>{await load();router.refresh();}}/>:null}
      {canEdit&&!policy.nextPolicy&&policy.status!=='CANCELLED'?<button type="button" className="text-button" disabled={busy} onClick={()=>{setNext({number:policy.number,premium:'',startDate:day(policy.endDate),endDate:''});setReviewed(false);setRenew(true);}}>Registrar nueva vigencia</button>:null}
      <Modal open={!!payment} onClose={()=>{if(!busy)setPayment(null);}} busy={busy} title="Confirmar pago" description="Registra lo realmente recibido. El resto del calendario conserva sus vencimientos.">{error?<p role="alert">{error}</p>:null}<div className="contact-form"><label>Fecha efectiva<input type="date" value={paidAt} max={data.today} onChange={e=>setPaidAt(e.target.value)}/></label><label>Referencia del pago<input value={reference} maxLength={250} onChange={e=>setReference(e.target.value)}/></label><label>Comprobante del expediente<Select value={documentId} onChange={e=>setDocumentId(e.target.value)}><option value="">Selecciona un documento</option>{data.evidence.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</Select></label></div><button type="button" className="button button-soft" onClick={()=>setDrivePicker(true)}>Elegir comprobante de Google Drive</button>{data.driveError?<p role="status">{data.driveError}</p>:null}<p><Link href={`/crm/documentos?clientId=${policy.clientId}`}>Abrir documentos para subir un comprobante</Link>. Después pulsa Actualizar documentos para actualizar la lista.</p><button type="button" className="text-button" onClick={()=>void load().catch(e=>setError(e.message))}>Actualizar documentos</button><label className="check-line"><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/>Verifiqué el pago y el comprobante; no es solo una promesa de pago.</label><button type="button" className="button" disabled={busy||!reviewed||!paidAt||!reference.trim()||!documentId} onClick={()=>void save('payment')}>Confirmar como pagado</button></Modal><Modal open={drivePicker} onClose={()=>setDrivePicker(false)} title="Comprobante de Google Drive" size="lg"><DriveFiles clientId={policy.clientId} onPick={(id,name)=>{setDrivePicker(false);void load().then(result=>{setData({...result,evidence:result.evidence.some(d=>d.id===id)?result.evidence:[...result.evidence,{id,name:name+' · Drive'}]});setDocumentId(id);}).catch(e=>setError(e.message));}}/></Modal>
      <Modal open={renew} onClose={()=>{if(!busy)setRenew(false);}} busy={busy} title="Nueva vigencia" description="Se crea un registro vinculado. No se cambia la prima, número ni calendario anterior.">{error?<p role="alert">{error}</p>:null}<div className="contact-form"><label>Número real de póliza<input value={next.number} maxLength={250} onChange={e=>setNext({...next,number:e.target.value})}/></label><label>Prima de la nueva vigencia ({policy.currency})<input type="number" min="0.01" step="0.01" value={next.premium} onChange={e=>setNext({...next,premium:e.target.value})}/></label><label>Inicio<input type="date" value={next.startDate} min={day(policy.endDate)} onChange={e=>setNext({...next,startDate:e.target.value})}/></label><label>Fin<input type="date" value={next.endDate} onChange={e=>setNext({...next,endDate:e.target.value})}/></label></div><p>Puede conservarse el mismo número si así lo emitió la aseguradora. El calendario nuevo se revisa después, por separado.</p><label className="check-line"><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/>Confirmé la emisión, prima y fechas con la documentación de la nueva vigencia.</label><button type="button" className="button" disabled={busy||!reviewed||!next.number.trim()||Number(next.premium)<=0||!next.endDate||next.endDate<=next.startDate} onClick={()=>void save('renew')}>Registrar renovación vinculada</button></Modal>
    </>:null}
  </details>;
}
