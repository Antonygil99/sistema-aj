'use client';
import { useLayoutEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RelationPicker } from './ui/relation-picker';
import { apiFetch } from './ui/client-api';
import { gsap, prefersReducedMotion } from './ui/motion';
import { useToast } from './ui/toast';
import { useConfirm } from './ui/confirm';
import Link from 'next/link';
import {PolicyExtraction} from './policy-extraction';
import {extractionToDraft,type ExtractedPolicy} from '@/modules/polizas/extraction';
import { clientIssues, frequencies, makeSchedule, policyInput, dossierInput } from '@/modules/clientes/dossier-policy';
export function DossierWizard({ clientId, prospect }: { clientId?: string; prospect?: { id: string; name: string; email: string; phone: string } }) {
  const router=useRouter(); const toast=useToast(); const confirm=useConfirm(); const schedulePending=useRef(false); const [changingSchedule,setChangingSchedule]=useState(false); const stepRef=useRef<HTMLDivElement>(null); const [step,setStep]=useState(clientId?1:0); const [busy,setBusy]=useState(false); const [error,setError]=useState('');
  const [client,setClient]=useState({name:prospect?.name??'',email:prospect?.email??'',phone:prospect?.phone??'',taxId:''});
  const [policy,setPolicy]=useState({number:'',insurer:'',product:'',premium:'',currency:'MXN',startDate:'',endDate:''});
  const [catalog,setCatalog]=useState<{productId:string;ownerEmail:string;label:string}>({productId:'',ownerEmail:'',label:''});
  const [frequency,setFrequency]=useState<keyof typeof frequencies>('MONTHLY');const [count,setCount]=useState(12);const [first,setFirst]=useState('');const [payments,setPayments]=useState<{amount:number;dueDate:string}[]>([]);
  const [withPolicy,setWithPolicy]=useState(true);
  const [frequencyConfirmed,setFrequencyConfirmed]=useState(true);
  const [sourceFile,setSourceFile]=useState<File|null>(null),[created,setCreated]=useState<{clientId:string;policyId:string|null}|null>(null);
  function applyExtraction(data:ExtractedPolicy,file:File){
    setPolicy(extractionToDraft(data));setFrequencyConfirmed(Boolean(data.paymentFrequency));
    setCatalog({productId:'',ownerEmail:'',label:''});setPayments([]);setSourceFile(file);
    setFirst(data.startDate??'');
    if(data.paymentFrequency){setFrequency(data.paymentFrequency);setCount(({ONCE:1,MONTHLY:12,QUARTERLY:4,SEMIANNUAL:2,ANNUAL:1})[data.paymentFrequency]);}
  }
  const policyData=()=>({...policy,premium:Number(policy.premium),paymentFrequency:frequency,payments,...(catalog.productId?{productId:catalog.productId}:{}),...(catalog.ownerEmail?{ownerEmail:catalog.ownerEmail}:{})});
  const clientData=()=>Object.fromEntries(Object.entries(client).filter(([key,value])=>key==='name'||value.trim()).map(([key,value])=>[key,value.trim()]));
  async function replaceSchedule(nextFrequency=frequency){
    if(schedulePending.current||busy)return;
    const nextCount=nextFrequency==='ONCE'?1:count,rows=makeSchedule(Number(policy.premium),nextCount,first,nextFrequency);
    if(!rows.length){setError('Revisa la prima, el número de recibos y el primer vencimiento antes de generar el calendario.');return;}
    if(nextFrequency===frequency&&JSON.stringify(rows)===JSON.stringify(payments))return;
    schedulePending.current=true;setChangingSchedule(true);
    try{
      if(payments.length&&!await confirm({
        title:nextFrequency==='ONCE'?'Cambiar a pago único':'Reemplazar calendario de recibos',
        message:nextFrequency==='ONCE'?
          `Se reemplazarán los ${payments.length} ${payments.length===1?'recibo':'recibos'} de este borrador por un solo recibo de ${Number(policy.premium).toFixed(2)} ${policy.currency}, con vencimiento el ${first.split('-').reverse().join('/')}. Se descartarán las fechas e importes editados. Estos recibos todavía no están guardados.`:
          `Se reemplazará el calendario de este borrador (${payments.length} recibos) por ${rows.length} recibos con periodicidad ${frequencies[nextFrequency].toLowerCase()}. Se descartarán las fechas e importes editados. Los recibos nuevos sumarán ${Number(policy.premium).toFixed(2)} ${policy.currency}.`,
        confirmLabel:nextFrequency==='ONCE'?'Reemplazar por un recibo':'Reemplazar calendario',cancelLabel:'Cancelar cambio',tone:'danger',
      }))return;
      setFrequency(nextFrequency);setFrequencyConfirmed(true);setCount(nextCount);setPayments(rows);setError('');
    }finally{schedulePending.current=false;setChangingSchedule(false);}
  }
  function next() { if(schedulePending.current)return;setError(''); if(step===0){const issues=clientIssues(clientData());if(issues.length){setError(issues.join(' '));return;}} if(step===1){if(!policy.currency||!policy.number||!policy.insurer||!policy.product||!policy.startDate||!policy.endDate||Number(policy.premium)<=0||policy.endDate<=policy.startDate){setError('Completa la póliza y revisa su vigencia y prima total.');return;}const date=first||policy.startDate;setFirst(date);if(frequencyConfirmed&&!payments.length)setPayments(makeSchedule(Number(policy.premium),count,date,frequency));} if(step===2){if(!frequencyConfirmed){setError('Confirma la periodicidad en los recibos antes de continuar.');return;}const result=policyInput.safeParse(policyData());if(!result.success){setError(result.error.issues.map(i=>i.message).join('. '));return;}}setStep(step===0&&!withPolicy?3:step+1); }
  useLayoutEffect(()=>{ if(stepRef.current&&!prefersReducedMotion()) gsap.fromTo(stepRef.current,{opacity:0,x:18},{opacity:1,x:0,duration:.36,clearProps:'transform'}); },[step]);
  async function save(){
    if(schedulePending.current||busy)return;
    setError('');let saved=created;
    if(!saved){const body=clientId?policyData():{client:clientData(),...(withPolicy?{policy:policyData()}:{}),...(prospect?{prospectId:prospect.id}:{})};const valid=(clientId?policyInput:dossierInput).safeParse(body);if(!valid.success){setError(valid.error.issues.map(i=>i.message).join('. '));return;}}
    setBusy(true);
    try{
      if(!saved){const result=await apiFetch<{data:{id:string;policyId?:string|null}}>(clientId?`/api/dossiers/${clientId}/policies`:'/api/dossiers',{method:'POST',json:clientId?policyData():{client:clientData(),...(withPolicy?{policy:policyData()}:{}),...(prospect?{prospectId:prospect.id}:{})}});saved={clientId:clientId||result.data.id,policyId:clientId?result.data.id:result.data.policyId??null};setCreated(saved);}
      if(sourceFile&&saved.policyId){const form=new FormData();form.set('file',sourceFile);form.set('policyId',saved.policyId);await apiFetch('/api/documents',{method:'POST',body:form});setSourceFile(null);}
      toast({kind:'success',title:clientId?'Póliza registrada':'Expediente creado',message:clientId?`${policy.number} · ${payments.length} recibos`:client.name.trim()});router.push(`/crm/clientes/${saved.clientId}`);router.refresh();
    }catch(e){const message=saved?'El registro ya quedó guardado. Falta adjuntar la carátula; puedes reintentar aquí sin crear otra póliza, o subirla desde el expediente.':e instanceof Error?e.message:'No se pudo guardar.';setError(message);toast({kind:'error',title:saved?'Carátula pendiente':'No se guardó',message});setBusy(false);}
  }
  return <section className="document-panel wizard"><div className="wizard-steps">{['Cliente','Póliza','Pagos','Revisión'].map((label,i)=><span key={label} aria-current={step===i?'step':undefined}>{i+1}. {label}</span>)}</div>
    <div ref={stepRef} className="wizard-step">{step===0?<><h2>Abre el expediente</h2><p>Los datos del cliente reúnen sus pólizas, documentos y seguimiento.</p><div className="contact-form">{(['name','email','phone','taxId'] as const).map((key,i)=><label key={key}>{['Nombre completo *','Correo','Teléfono','RFC'][i]}<input value={client[key]} type={key==='email'?'email':'text'} maxLength={250} onChange={e=>setClient({...client,[key]:e.target.value})}/></label>)}</div><label className="check-line"><input type="checkbox" checked={withPolicy} onChange={e=>setWithPolicy(e.target.checked)}/>Registrar su primera póliza ahora</label><p className="lead-small">Sin póliza quedará “Por completar”, no como cliente activo.</p></>:null}
    {step===1?<><PolicyExtraction onApply={applyExtraction}/><h2>Vigencia de la cobertura</h2><p>Captura el número completo con prefijo, ceros y separadores tal como aparece en la carátula.</p><p>La vigencia indica cuándo está cubierto. El plan de pagos se registra por separado.</p><div className="contact-form"><div className="form-field wizard-catalog"><span className="form-label">Producto del catálogo <span className="optional">Opcional</span></span><RelationPicker relation="productos" value={catalog.productId} initialLabel={catalog.label} label="Producto del catálogo" onChange={(id,label,row)=>{setCatalog({productId:id,label,ownerEmail:typeof row?.ownerEmail==='string'?row.ownerEmail:''});if(row)setPolicy(current=>({...current,insurer:current.insurer||String(row.insurer??''),product:current.product||String(row.name??'')}));}}/><small className="form-hint">Completa aseguradora y producto, y asigna al responsable de ese ramo.</small></div>{(['number','insurer','product','premium','startDate','endDate'] as const).map((key,i)=><label key={key}>{['Número de póliza *','Aseguradora *','Producto / cobertura *','Prima total, incluidos cargos *','Inicio de vigencia *','Fin de vigencia *'][i]}<input type={key.includes('Date')?'date':key==='premium'?'number':'text'} step={key==='premium'?'.01':undefined} min={key==='premium'?'0.01':undefined} value={policy[key]} maxLength={250} onChange={e=>{setPolicy({...policy,[key]:e.target.value});setPayments([]);}}/></label>)}<label>Moneda<select value={policy.currency} onChange={e=>setPolicy({...policy,currency:e.target.value})}><option value="">Confirmar moneda</option><option>MXN</option><option>USD</option></select></label></div></>:null}
    {step===2?<><h2>Calendario de recibos</h2><p>Genera una propuesta y ajusta fechas e importes al contrato. Ningún recibo se marca pagado automáticamente.</p><div className="contact-form"><label>Periodicidad<select value={frequencyConfirmed?frequency:''} disabled={busy||changingSchedule} onChange={e=>void replaceSchedule(e.target.value as keyof typeof frequencies)}><option value="" disabled>Confirmar según recibos</option>{Object.entries(frequencies).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label>Número de recibos<input type="number" min="1" max={frequency==='ONCE'?1:120} disabled={busy||changingSchedule||frequency==='ONCE'} value={count} onChange={e=>setCount(Number(e.target.value))}/></label><label>Primer vencimiento<input type="date" disabled={busy||changingSchedule} value={first} onChange={e=>setFirst(e.target.value)}/></label></div><button type="button" className="text-button" disabled={busy||changingSchedule||!frequencyConfirmed} onClick={()=>void replaceSchedule()}>Generar calendario</button>{frequency==='ONCE'?<p className="lead-small">Pago único: un recibo por la prima total.</p>:null}<div className="payment-editor">{payments.map((p,i)=><div className="contact-form" key={i}><span>Recibo {i+1}</span><label>Vencimiento<input type="date" value={p.dueDate} onChange={e=>setPayments(payments.map((v,j)=>j===i?{...v,dueDate:e.target.value}:v))}/></label><label>Importe ({policy.currency})<input type="number" min=".01" step=".01" value={p.amount} onChange={e=>setPayments(payments.map((v,j)=>j===i?{...v,amount:Number(e.target.value)}:v))}/></label></div>)}</div><p>Total de recibos: {payments.reduce((s,p)=>s+p.amount,0).toFixed(2)} / Prima total: {policy.premium} {policy.currency}</p></>:null}
    {step===3?<><h2>Revisa antes de guardar</h2>{!clientId?<p><strong>{client.name}</strong><br/>{client.email} · {client.phone}</p>:null}{withPolicy?<><p>{policy.insurer} · {policy.product} · Póliza {policy.number}</p><p>Vigencia: {policy.startDate} → {policy.endDate}</p><p>Prima total: {policy.premium} {policy.currency} · {frequencies[frequency]} · {payments.length} recibos</p><p>Pagos desde {payments[0]?.dueDate} hasta {payments.at(-1)?.dueDate}</p></>:<p>Se creará un expediente por completar, con carpetas para identificación, pólizas, pagos y siniestros.</p>}</>:null}
    </div>{error?<p role="alert">{error}</p>:null}{created?<p><Link href={`/crm/clientes/${created.clientId}`}>Abrir el expediente ya guardado</Link></p>:null}<div className="wizard-actions"><button type="button" className="text-button" disabled={busy||changingSchedule||step===(clientId?1:0)||!!created} onClick={()=>setStep(step===3&&!withPolicy?0:step-1)}>Anterior</button>{step<3?<button type="button" className="button" disabled={busy||changingSchedule} onClick={next}>Continuar</button>:<button type="button" className="button" disabled={busy} onClick={()=>void save()}>{busy?'Guardando…':created?'Reintentar adjuntar carátula':'Guardar expediente'}</button>}</div>
  </section>;
}
