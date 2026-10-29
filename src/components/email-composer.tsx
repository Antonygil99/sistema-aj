'use client';
import {Select} from '@/components/ui/select';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { DocumentText, Edit2, Eye, Send2, Sms } from '@/components/icons';
import { MAX_ATTACHMENTS, type Recipient } from '@/modules/email/rules';
import { clientEmail, type ClientEmailKind } from '@/modules/email/templates';
import {RichEmailEditor} from './rich-email-editor';
import { BLANK,fillTemplate,templateInfo,type Placeholder } from '@/modules/email/template-text';
import { apiFetch } from './ui/client-api';
import { useConfirm } from './ui/confirm';
import { Modal } from './ui/modal';
import { RelationPicker } from './ui/relation-picker';
import { useToast } from './ui/toast';
type Options = { templates?:{id:string;name:string;kind:ClientEmailKind}[];templateId?:string|null;values?:Partial<Record<Placeholder,string>>;policies?:{id:string;number:string}[];payments?:{id:string;label:string}[];client: { id: string; name: string; email: string | null }; kind: ClientEmailKind; draft: { subject: string; message: string }; recipients: Recipient[]; documents: { id: string; name: string; detail: string }[]; welcomeSentAt: string | null; configured: boolean };
// What opens the composer: the kind of email, the client (or null to pick one), files chosen beforehand and, from
// Avisos, the notice it answers (its data fills the suggested text and sending marks it as sent).
export type ComposerRequest = { kind: ClientEmailKind; clientId: string | null; clientName?: string; documents?: { id: string; name: string }[]; noticeId?: string; draft?: { subject: string; message: string } };
type Errors = Partial<Record<'client' | 'to' | 'subject' | 'message', string>>;
const titles: Record<ClientEmailKind, string> = { DOCUMENTOS: 'Escribir correo al cliente', BIENVENIDA: 'Enviar bienvenida', RENOVACION: 'Aviso de renovación', PAGO: 'Recordatorio de pago', SINIESTRO: 'Seguimiento de siniestro' };
const sentTitles: Record<ClientEmailKind, string> = { DOCUMENTOS: 'Correo enviado', BIENVENIDA: 'Bienvenida enviada', RENOVACION: 'Aviso de renovación enviado', PAGO: 'Recordatorio enviado', SINIESTRO: 'Seguimiento enviado' };
const newRequestId = () => crypto.randomUUID();
// A person always reviews what goes to a client: recipients (the client and its registered contacts only), text and
// attachments, with a preview of the exact email. Replies reach the sender's own inbox.
export function EmailComposer({ request, senderName, onClose, onSent }: { request: ComposerRequest | null; senderName: string; onClose: () => void; onSent?: (kind: ClientEmailKind) => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [opened, setOpened] = useState<ComposerRequest | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [loadFor, setLoadFor] = useState<string | null>(null);
  const [options, setOptions] = useState<Options | null>(null);
  const [to, setTo] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [documentIds, setDocumentIds] = useState<string[]>([]);
  const [verified,setVerified]=useState(false),[verification,setVerification]=useState('');
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [dirty, setDirty] = useState(false);
  const [requestId, setRequestId] = useState(newRequestId);
  const formRef = useRef<HTMLFormElement>(null);
  const ids = { to: useId(), subject: useId(), message: useId(), files: useId() };
  const [kind,setKind]=useState<ClientEmailKind>('DOCUMENTOS'),[templateId,setTemplateId]=useState(''),[policyId,setPolicyId]=useState(''),[paymentId,setPaymentId]=useState('');
  const loading = loadFor !== null;
  // Each opening starts a fresh draft, with a fresh requestId so the same draft never sends twice.
  if (request !== opened) {
    setOpened(request);
    if (request) {
      setKind(request.kind);setTemplateId('');setPolicyId('');setPaymentId('');setRequestId(newRequestId());
      setClientId(request.clientId); setLoadFor(request.clientId); setOptions(null);
      setVerified(false);setVerification('');setTo([]); setErrors({}); setDirty(false); setPreview(false); setSubject(''); setMessage('');
      setDocumentIds((request.documents ?? []).map(doc => doc.id));
    }
  }
  useEffect(() => {
    if (!loadFor) return;
    let active = true;
    const query = new URLSearchParams({ clientId: loadFor, kind,...(templateId?{templateId}:{}),...(policyId?{policyId}:{}),...(paymentId?{paymentId}:{}), ...(request?.noticeId ? { noticeId: request.noticeId } : {}) });
    apiFetch<{ data: Options }>(`/api/emails/options?${query}`)
      .then(({ data }) => {
        if (!active) return;
        setOptions(data);setVerified(false);setDocumentIds(ids=>ids.filter(id=>data.documents.some(doc=>doc.id===id)));
        setTo(data.recipients.filter(recipient => recipient.label === 'Cliente').map(recipient => recipient.email));
        const draft = templateId||policyId||paymentId?data.draft:request?.draft ?? data.draft;
        setSubject(draft.subject); setMessage(draft.message);
      })
      .catch(error => { if (active) {setOptions(null);toast({ kind: 'error', title: 'No se pudo preparar el correo', message: error instanceof Error ? error.message : undefined });} })
      .finally(() => { if (active) setLoadFor(null); });
    return () => { active = false; };
  }, [loadFor, kind, request?.noticeId, request?.draft, toast,templateId,policyId,paymentId]);
  const files=options?.documents??[];
  const selectedNames = files.filter(file => documentIds.includes(file.id)).map(file => file.name);
  const previewHtml = useMemo(() => preview ? clientEmail({ subject:fillTemplate(subject,options?.values??{}), message:fillTemplate(message,options?.values??{}), senderName, attachments: selectedNames }).html : '', [preview, subject, message, senderName, selectedNames,options?.values]);
  async function close() {
    if (busy) return;
    if (dirty && !await confirm({ title: 'Descartar el correo', message: 'Perderás lo que escribiste en este correo.', confirmLabel: 'Descartar', tone: 'danger' })) return;
    onClose();
  }
  const toggle = (list: string[], value: string) => list.includes(value) ? list.filter(item => item !== value) : [...list, value];
  async function send() {
    const next: Errors = {};
    if (!clientId) next.client = 'Elige el cliente.';
    if (!to.length) next.to = 'Elige al menos un destinatario.';
    if (!subject.trim()) next.subject = 'Escribe el asunto.';
    if (!message.trim()) next.message = 'Escribe el mensaje.';
    else if (BLANK.test(message)) next.message = 'Completa el texto entre corchetes antes de enviar.';
    if(documentIds.length&&(!verified||verification.trim().length<5))next.to='Confirma identidad y autorización de todos los destinatarios y registra la referencia.';
    const finalSubject=fillTemplate(subject,options?.values??{}),finalMessage=fillTemplate(message,options?.values??{});
    if(/\{[^{}]+\}/.test(finalSubject+' '+finalMessage))next.message='Hay variables pendientes: selecciona la póliza o el recibo, o completa el contenido antes de enviar.';
    setErrors(next);
    if (Object.keys(next).length) { formRef.current?.querySelector<HTMLElement>(next.client ? '.relation-picker input' : next.to ? '.email-recipients input' : '[aria-invalid="true"]')?.focus(); return; }
    setBusy(true);
    try {
      await apiFetch('/api/emails', { method: 'POST', json: { requestId, kind, clientId, to, subject:finalSubject, message:finalMessage, documentIds, ...(documentIds.length?{deliveryConfirmation:{verified,reference:verification}}:{}), ...(request?.noticeId ? { noticeId: request.noticeId } : {}) }, labels: { to: 'Para', subject: 'Asunto', message: 'Mensaje', documentIds: 'Adjuntos' } });
      toast({ kind: 'success', title: sentTitles[kind], message: `Para ${to.join(', ')}` });
      onSent?.(kind);
      onClose();
    } catch (error) {
      // The same requestId can retry: the server only records a draft once it passed validation, and a failed
      // attempt is kept apart so the retry sends.
      toast({ kind: 'error', title: 'No se envió el correo', message: error instanceof Error ? error.message : undefined });
    } finally { setBusy(false); }
  }
  return <Modal icon={Sms} open={request !== null} onClose={() => void close()} busy={busy} size="lg" className="email-composer" title={titles[kind]}
    description={options ? `${options.client.name} · las respuestas te llegarán a ti` : request?.clientName}
    footer={<>
      <button type="button" className="text-button" onClick={() => setPreview(value => !value)} disabled={!options} aria-pressed={preview}>{preview?<Edit2 aria-hidden="true"/>:<Eye aria-hidden="true"/>}{preview ? 'Editar' : 'Vista previa'}</button>
      <span className="modal-footer-spacer"/>
      <button type="button" className="text-button" disabled={busy} onClick={() => void close()}>Cancelar</button>
      <button type="submit" form="email-composer-form" className="button" disabled={busy || loading || !options || !options.configured}><Send2 aria-hidden="true"/>{busy ? 'Enviando…' : 'Enviar'}</button>
    </>}>
    <form id="email-composer-form" ref={formRef} className="resource-form" onSubmit={event => { event.preventDefault(); void send(); }} onChange={() => setDirty(true)}>
      {!request?.clientId ? <div className={`form-field is-wide${errors.client ? ' is-invalid' : ''}`}>
        <span className="form-label">Cliente</span>
        <RelationPicker relation="clientes" value={clientId ?? ''} initialLabel="" label="Cliente" required onChange={id => { setVerified(false);setVerification('');setDocumentIds([]);setPolicyId('');setPaymentId('');setClientId(id || null); setOptions(null); setLoadFor(id || null); }}/>
        {errors.client ? <small className="field-error">{errors.client}</small> : null}
      </div> : null}
      {options && !options.configured ? <p className="notice is-wide" role="alert">El envío de correos no está configurado en el servidor.</p> : null}
      {!options&&!loading&&clientId?<button type="button" className="text-button" onClick={()=>setLoadFor(clientId)}>Reintentar preparar correo</button>:null}
      {loading ? <p className="lead-small is-wide" role="status">Preparando el correo…</p> : null}
      {options && preview ? <div className="email-preview is-wide"><iframe title="Vista previa del correo" sandbox="" srcDoc={previewHtml}/></div> : null}
      {options && !preview ? <>
        <fieldset className={`form-field is-wide email-recipients${errors.to ? ' is-invalid' : ''}`} aria-describedby={errors.to ? `${ids.to}-error` : undefined}>
          <legend className="form-label">Para</legend>
          {options.recipients.length ? options.recipients.map(recipient => <label key={recipient.email} className="email-check">
            <input type="checkbox" checked={to.includes(recipient.email)} onChange={() => { setVerified(false);setTo(current => toggle(current, recipient.email)); setDirty(true); }}/>
            <span><strong>{recipient.name}</strong> <small>{recipient.label} · {recipient.email}</small></span>
          </label>) : <p className="form-hint">Este cliente no tiene correo ni contactos con correo. <Link href={`/crm/clientes/${options.client.id}#contactos`}>Agrégalos en su expediente</Link>.</p>}
          {errors.to ? <small id={`${ids.to}-error`} className="field-error">{errors.to}</small> : null}
          <small className="form-hint">Solo el cliente y sus contactos registrados. Para escribir a alguien más, agrégalo como contacto.</small>
        </fieldset>
        <div className="form-field is-wide"><label>Usar una de mis plantillas<Select value={templateId} disabled={busy} onChange={async e=>{const id=e.target.value;if(dirty&&!await confirm({title:'Cambiar el borrador',message:'La plantilla seleccionada reemplazará el asunto y el contenido que editaste.',confirmLabel:'Usar plantilla'}))return;setTemplateId(id);const t=options.templates?.find(t=>t.id===id);if(t)setKind(t.kind);setLoadFor(clientId);setDirty(false);}}><option value="">Mi predeterminada / texto sugerido</option>{(options.templates??[]).filter(t=>!request?.noticeId||t.kind===kind).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</Select></label><Link href="/avisos?tab=plantillas" target="_blank">Administrar mis plantillas ↗</Link></div>
        {!request?.noticeId?<div className="form-field is-wide contact-form"><label>Póliza para completar variables<Select value={policyId} disabled={busy} onChange={async e=>{const id=e.target.value;if(dirty&&!await confirm({title:'Actualizar datos del borrador',message:'Se volverá a preparar el mensaje con los datos elegidos. Conserva aparte cualquier edición que quieras reutilizar.',confirmLabel:'Actualizar'}))return;setPolicyId(id);setPaymentId('');setLoadFor(clientId);setDirty(false);}}><option value="">Sin póliza seleccionada</option>{options.policies?.map(p=><option key={p.id} value={p.id}>{p.number}</option>)}</Select></label>{policyId?<label>Recibo para completar importe y fecha<Select value={paymentId} disabled={busy} onChange={async e=>{const id=e.target.value;if(dirty&&!await confirm({title:'Actualizar recibo del borrador',message:'Se volverá a preparar el mensaje con el recibo elegido.',confirmLabel:'Actualizar'}))return;setPaymentId(id);setLoadFor(clientId);setDirty(false);}}><option value="">Seleccionar recibo</option>{options.payments?.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</Select></label>:null}</div>:null}
        <div className="form-field is-wide"><RichEmailEditor label="Asunto" singleLine value={subject} disabled={busy} onChange={value=>{setSubject(value);setDirty(true);}} variables={templateInfo[kind].placeholders}/>{errors.subject?<small className="field-error">{errors.subject}</small>:null}</div>
        <div className="form-field is-wide"><RichEmailEditor label="Mensaje" value={message} disabled={busy} onChange={value=>{setMessage(value);setDirty(true);}} variables={templateInfo[kind].placeholders}/>{errors.message?<small className="field-error">{errors.message}</small>:null}</div>
        <fieldset className="form-field is-wide email-files">
          <legend className="form-label">Adjuntos <span className="optional">{documentIds.length}/{MAX_ATTACHMENTS}</span></legend>
          {files.length ? <div className="email-file-list">{files.map(file => <label key={file.id} className="email-check">
            <input type="checkbox" checked={documentIds.includes(file.id)} disabled={!documentIds.includes(file.id) && documentIds.length >= MAX_ATTACHMENTS} onChange={() => { setVerified(false);setDocumentIds(current => toggle(current, file.id)); setDirty(true); }}/>
            <DocumentText aria-hidden="true"/><span><strong>{file.name}</strong> <small>{file.detail}</small></span>
          </label>)}</div> : <p className="form-hint">Este expediente aún no tiene archivos. Súbelos en sus documentos y vuelve aquí.</p>}
          {kind === 'BIENVENIDA' && files.length ? <small className="form-hint">Elige la póliza y los recibos que quieres que tenga a la mano.</small> : null}
        </fieldset>
        {documentIds.length>0?<div className="form-field is-wide"><label className="email-check"><input type="checkbox" checked={verified} onChange={e=>setVerified(e.target.checked)}/>Verifiqué la identidad y la titularidad o autorización de todos los destinatarios para recibir estos documentos de sus pólizas.</label><label>Referencia de verificación (sin datos sensibles)<input maxLength={250} value={verification} onChange={e=>setVerification(e.target.value)} placeholder="Ej.: llamada verificada del día y folio interno"/></label></div>:null}
        {kind === 'BIENVENIDA' && options.welcomeSentAt ? <p className="form-hint is-wide">Ya se le envió una bienvenida el {new Date(options.welcomeSentAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Mexico_City' })}.</p> : null}
      </> : null}
    </form>
  </Modal>;
}
