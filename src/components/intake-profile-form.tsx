'use client';
import {Select} from '@/components/ui/select';

import { useState } from 'react';
import { profileSchema, type IntakeProfile } from '@/modules/intake/schema';
type Draft=Omit<IntakeProfile,'privacyAccepted'|'informationConfirmed'> & {privacyAccepted:boolean;informationConfirmed:boolean};
export function IntakeProfileForm({initial,onSave,busy,staff=false}:{initial?:Partial<IntakeProfile>|null;onSave:(answers:IntakeProfile)=>Promise<void>;busy:boolean;staff?:boolean}){
  const [draft,setDraft]=useState<Draft>({personType:'PERSON',fullName:'',givenNames:'',paternalSurname:'',maternalSurname:'',email:'',phone:'',taxId:'',birthDate:'',occupation:'',street:'',exterior:'',interior:'',postalCode:'',colony:'',city:'',state:'',country:'México',interests:[],respondent:'SELF',representativeName:'',representativeRelation:'',vehicleBrand:'',vehicleModel:'',vehicleYear:'',plates:'',...initial,privacyAccepted:false,informationConfirmed:false});
  const [error,setError]=useState('');
  const text=(key:keyof Draft,label:string,type='text',max=120)=><label className="intake-field"><span>{label}</span><input name={key} type={type} value={String(draft[key])} maxLength={max} required={key==='fullName'} onChange={e=>setDraft(v=>({...v,[key]:e.target.value}))}/></label>;
  async function submit(e:React.FormEvent){e.preventDefault();setError('');const result=profileSchema.safeParse(draft);if(!result.success){setError(result.error.issues.map(i=>i.message).join(' '));return;}await onSave(result.data);}
  return <form className="intake-form" onSubmit={e=>void submit(e)}>
    <p className="intake-hint">Completa los datos del cliente que tendrá el expediente, aunque otra persona le ayude a capturar. Los campos adicionales son opcionales. No incluyas diagnósticos, historial médico, cuentas bancarias ni contraseñas.</p>
    <fieldset disabled={busy}><legend>1. Identificación y contacto</legend><div className="intake-grid">
      <label className="intake-field"><span>Tipo de cliente</span><Select value={draft.personType} onChange={e=>setDraft(v=>({...v,personType:e.target.value as Draft['personType'],birthDate:e.target.value==='COMPANY'?'':v.birthDate}))}><option value="PERSON">Persona física</option><option value="COMPANY">Empresa / persona moral</option></Select></label>
      {text('fullName',draft.personType==='PERSON'?'Nombre completo del cliente *':'Razón social del cliente *')}{text('email','Correo electrónico','email',254)}{text('phone','Teléfono con código de país','tel',16)}
      {text('taxId','RFC (opcional)','text',13)}{draft.personType==='PERSON'?text('birthDate','Fecha de nacimiento (opcional)','date'):null}
    </div></fieldset>
    <details className="intake-section"><summary>Datos adicionales para evitar capturas repetidas</summary><fieldset disabled={busy}><legend>2. Datos personales y domicilio</legend><div className="intake-grid">
      {draft.personType==='PERSON'?<>{text('givenNames','Nombre(s), tal como aparecen en identificación')}{text('paternalSurname','Apellido paterno')}{text('maternalSurname','Apellido materno')}{text('occupation','Ocupación (sin información médica)')}</>:null}
      {text('street','Calle / avenida')}{text('exterior','Número exterior','text',30)}{text('interior','Número interior','text',30)}{text('postalCode','Código postal de México','text',5)}{text('colony','Colonia')}{text('city','Ciudad / municipio')}{text('state','Estado')}{text('country','País','text',60)}
    </div></fieldset></details>
    <fieldset disabled={busy}><legend>3. Seguros de interés</legend><p className="intake-hint">Esto ayuda a asignar el seguimiento. No cambia una póliza ni solicita un seguro por sí mismo.</p><div className="intake-options">{([['MEDICAL','Gastos médicos · Ale'],['LIFE','Vida · Ale'],['AUTO','Autos · Joel']] as const).map(([value,label])=><label key={value}><input type="checkbox" checked={draft.interests.includes(value)} onChange={e=>setDraft(v=>({...v,interests:e.target.checked?[...v.interests,value]:v.interests.filter(i=>i!==value)}))}/>{label}</label>)}</div>
      {draft.interests.includes('AUTO')?<div className="intake-grid">{text('vehicleBrand','Marca del vehículo (opcional)','text',60)}{text('vehicleModel','Modelo (opcional)','text',60)}{text('vehicleYear','Año (opcional)','text',4)}{text('plates','Placas (opcional)','text',20)}</div>:null}
    </fieldset>
    <fieldset disabled={busy}><legend>4. Quién proporciona los datos</legend><label className="intake-field"><span>Captura</span><Select value={draft.respondent} onChange={e=>setDraft(v=>({...v,respondent:e.target.value as Draft['respondent']}))}><option value="SELF">El propio cliente</option><option value="REPRESENTATIVE">Una persona autorizada ayuda al cliente</option></Select></label>
      {draft.respondent==='REPRESENTATIVE'?<div className="intake-grid">{text('representativeName','Nombre de quien ayuda')}{text('representativeRelation','Relación con el cliente')}</div>:null}
      <p className="intake-hint">La ficha sirve para organizar datos administrativos. Las declaraciones, autorizaciones y firmas de cada aseguradora se completan por separado. Para menores, registra al representante que corresponda.</p>
      <label className="intake-check"><input type="checkbox" required checked={draft.privacyAccepted} onChange={e=>setDraft(v=>({...v,privacyAccepted:e.target.checked}))}/><span>{staff?'Confirmo que el cliente o su representante conoce el aviso de privacidad de AJ y autorizó registrar estos datos administrativos.':'He leído el aviso de privacidad de AJ y autorizo el uso de estos datos para integrar mi expediente y gestionar el seguimiento solicitado.'} <a href="/privacidad" target="_blank" rel="noreferrer">Consultar aviso de privacidad</a>.</span></label>
      <label className="intake-check"><input type="checkbox" required checked={draft.informationConfirmed} onChange={e=>setDraft(v=>({...v,informationConfirmed:e.target.checked}))}/><span>{staff?'Revisé los datos con el cliente o su representante; no asumí respuestas faltantes.':'Confirmo que los datos son correctos y que tengo autorización para proporcionarlos.'}</span></label>
    </fieldset>
    {error?<p className="intake-error" role="alert">{error}</p>:null}<button className="button intake-submit" type="submit" disabled={busy}>{busy?'Guardando…':staff?'Guardar para revisión':'Enviar mis datos a AJ'}</button>
  </form>;
}
