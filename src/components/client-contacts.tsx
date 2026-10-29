'use client';
import { useRef, useState } from 'react';
import { TickCircle, Call, Edit2, Profile2User, Sms, Trash, UserAdd } from '@/components/icons';
import { ApiError, apiFetch } from './ui/client-api';
import { useConfirm } from './ui/confirm';
import { Modal } from './ui/modal';
import { useToast } from './ui/toast';
export type ContactRow = { id: string; name: string; email: string | null; phone: string | null; role: string };
type Draft = { name: string; role: string; email: string; phone: string };
type Field = keyof Draft;
const empty: Draft = { name: '', role: '', email: '', phone: '' };
const labels: Record<Field, string> = { name: 'Nombre', role: 'Relación', email: 'Correo electrónico', phone: 'Teléfono' };
// People besides the client who may receive emails about it (HR of a company, a relative). Only contact data.
export function ClientContacts({ clientId, initial, canEdit }: { clientId: string; initial: ContactRow[]; canEdit: boolean }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [contacts, setContacts] = useState(initial);
  const [editing, setEditing] = useState<ContactRow | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(empty);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const dirty = editing !== null && JSON.stringify(draft) !== JSON.stringify(editing === 'new' ? empty : { name: editing.name, role: editing.role, email: editing.email ?? '', phone: editing.phone ?? '' });
  function open(contact: ContactRow | 'new') {
    setErrors({});
    setDraft(contact === 'new' ? empty : { name: contact.name, role: contact.role, email: contact.email ?? '', phone: contact.phone ?? '' });
    setEditing(contact);
  }
  async function close() {
    if (busy) return;
    if (dirty && !await confirm({ title: 'Descartar cambios', message: 'Perderás los datos que escribiste para este contacto.', confirmLabel: 'Descartar', tone: 'danger' })) return;
    setEditing(null);
  }
  async function save() {
    if (!editing) return;
    setBusy(true); setErrors({});
    try {
      const { data } = await apiFetch<{ data: ContactRow }>(editing === 'new' ? `/api/dossiers/${clientId}/contacts` : `/api/dossiers/${clientId}/contacts/${editing.id}`, { method: editing === 'new' ? 'POST' : 'PATCH', json: draft, labels });
      setContacts(current => [...current.filter(item => item.id !== data.id), data].sort((a, b) => a.name.localeCompare(b.name, 'es')));
      toast({ kind: 'success', title: editing === 'new' ? 'Contacto agregado' : 'Contacto actualizado', message: data.name });
      setEditing(null);
    } catch (error) {
      // Field errors go under their field; the first one takes the focus.
      if (error instanceof ApiError && error.code === 'INVALID_INPUT' && error.issues.length) {
        const next: Partial<Record<Field, string>> = {};
        for (const issue of error.issues) { const field = issue.path?.[0]; if (typeof field === 'string' && field in labels && !next[field as Field]) next[field as Field] = issue.code === 'custom' && issue.message ? issue.message : `Revisa el campo «${labels[field as Field]}».`; }
        setErrors(next);
        requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      } else toast({ kind: 'error', title: 'No se guardó el contacto', message: error instanceof Error ? error.message : undefined });
    } finally { setBusy(false); }
  }
  async function remove(contact: ContactRow) {
    if (!await confirm({ title: 'Quitar contacto', message: `«${contact.name}» dejará de aparecer como destinatario de los correos de este cliente.`, confirmLabel: 'Quitar contacto', tone: 'danger' })) return;
    try { await apiFetch(`/api/dossiers/${clientId}/contacts/${contact.id}`, { method: 'DELETE' }); setContacts(current => current.filter(item => item.id !== contact.id)); toast({ kind: 'success', title: 'Contacto quitado', message: contact.name }); }
    catch (error) { toast({ kind: 'error', title: 'No se quitó el contacto', message: error instanceof Error ? error.message : undefined }); }
  }
  const field = (name: Field, type: 'text' | 'email' | 'tel', props: { required?: boolean; maxLength: number; placeholder?: string; autoComplete?: string }) => <div className={`form-field${errors[name] ? ' is-invalid' : ''}`}>
    <label><span className="form-label">{labels[name]}{props.required ? null : <span className="optional">Opcional</span>}</span>
      <input type={type} value={draft[name]} {...props} data-autofocus={name === 'name' || undefined} aria-invalid={errors[name] ? true : undefined} aria-describedby={errors[name] ? `contacto-${name}-error` : undefined} onChange={event => setDraft(current => ({ ...current, [name]: event.target.value }))}/></label>
    {errors[name] ? <small id={`contacto-${name}-error`} className="field-error">{errors[name]}</small> : null}
  </div>;
  return <section className="document-panel client-contacts" id="contactos" aria-labelledby="contactos-titulo">
    <div className="contact-toolbar"><h2 id="contactos-titulo">Contactos</h2>{canEdit ? <button type="button" className="button button-soft" onClick={() => open('new')}><UserAdd aria-hidden="true"/>Agregar contacto</button> : null}</div>
    <p className="lead-small">Personas además del cliente a quienes se les puede escribir sobre este expediente, por ejemplo RH de una empresa o un familiar.</p>
    {contacts.length ? <ul className="contact-list">{contacts.map(contact => <li key={contact.id}>
      <Profile2User aria-hidden="true"/>
      <div className="contact-info"><strong>{contact.name}</strong>{contact.role ? <small>{contact.role}</small> : null}
        <span className="contact-means">{contact.email ? <a href={`mailto:${contact.email}`}><Sms aria-hidden="true"/>{contact.email}</a> : null}{contact.phone ? <a href={`tel:${contact.phone}`}><Call aria-hidden="true"/>{contact.phone}</a> : null}</span></div>
      {canEdit ? <div className="row-actions"><button type="button" className="icon-button" aria-label={`Editar ${contact.name}`} onClick={() => open(contact)}><Edit2 aria-hidden="true"/></button><button type="button" className="icon-button is-danger" aria-label={`Quitar ${contact.name}`} onClick={() => void remove(contact)}><Trash aria-hidden="true"/></button></div> : null}
    </li>)}</ul> : <p className="form-hint">Sin contactos adicionales.</p>}
    <Modal open={editing !== null} onClose={() => void close()} busy={busy} size="sm" title={editing === 'new' ? 'Nuevo contacto' : 'Editar contacto'} description="Registra al menos un correo o un teléfono."
      footer={<><span className="modal-footer-spacer"/><button type="button" className="text-button" disabled={busy} onClick={() => void close()}>Cancelar</button><button type="submit" form="contact-form" className="button" disabled={busy || !draft.name.trim()}><TickCircle aria-hidden="true"/>Guardar</button></>}>
      <form id="contact-form" ref={formRef} className="resource-form" onSubmit={event => { event.preventDefault(); void save(); }}>
        {field('name', 'text', { required: true, maxLength: 120, autoComplete: 'name' })}
        {field('role', 'text', { maxLength: 60, placeholder: 'RH, esposa, contador…' })}
        {field('email', 'email', { maxLength: 254, autoComplete: 'email' })}
        {field('phone', 'tel', { maxLength: 16, placeholder: '+525512345678', autoComplete: 'tel' })}
      </form>
    </Modal>
  </section>;
}
