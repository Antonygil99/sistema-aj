'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { prospectStatuses, statusLabels } from '@/modules/shared/contact-list';
export type ContactRow = { id: string; name: string; email: string | null; phone: string | null; createdAt: string; updatedAt: string; source?: string; notes?: string | null; status?: keyof typeof statusLabels; taxId?: string | null };
type Fields = { name: string; email: string; phone: string; source: string; notes: string; status: keyof typeof statusLabels; taxId: string };
const empty: Fields = { name: '', email: '', phone: '', source: 'manual', notes: '', status: 'NEW', taxId: '' };
const errorMessages: Record<string, string> = {
  INVALID_INPUT: 'Revisa los datos: nombre obligatorio, correo válido y teléfono de 8 a 15 dígitos.',
  RECORD_CHANGED: 'Otra persona modificó este registro. Conservamos tu borrador: cierra esta ficha y vuelve a abrirla para revisar la versión actual antes de guardar.',
  RECORD_NOT_FOUND: 'El registro ya no está disponible. Actualiza el listado.',
  UNAUTHORIZED: 'Tu sesión terminó. Vuelve a entrar con Google.',
  FORBIDDEN: 'Tu cuenta no tiene permiso para modificar registros.',
};
export function ContactManager({ slug, initial, initialTotal, canEdit }: { slug: 'prospectos' | 'clientes'; initial: ContactRow[]; initialTotal: number; canEdit: boolean }) {
  const prospect = slug === 'prospectos';
  const singular = prospect ? 'prospecto' : 'cliente';
  const [rows, setRows] = useState(initial);
  const [total, setTotal] = useState(initialTotal);
  const [skip, setSkip] = useState(0);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [applied, setApplied] = useState({ query: '', status: '' });
  const [editing, setEditing] = useState<ContactRow | 'new' | null>(null);
  const [fields, setFields] = useState<Fields>(empty);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (editing) { editorRef.current?.scrollIntoView({ block: 'nearest' }); if (canEdit) nameRef.current?.focus(); else editorRef.current?.focus(); } }, [editing, canEdit]);
  function open(row: ContactRow | 'new') {
    setEditing(row); setMessage('');
    setFields(row === 'new' ? { ...empty } : { name: row.name, email: row.email ?? '', phone: row.phone ?? '', source: row.source ?? 'manual', notes: row.notes ?? '', status: row.status ?? 'NEW', taxId: row.taxId ?? '' });
  }
  function field(name: keyof Fields, value: string) { setFields(current => ({ ...current, [name]: value })); }
  async function load(nextSkip: number, filters = applied) {
    const params = new URLSearchParams({ take: '20', skip: String(nextSkip), q: filters.query });
    if (prospect && filters.status) params.set('status', filters.status);
    const response = await fetch(`/api/crm/${slug}?${params}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('No se pudo actualizar el listado. Comprueba tu sesión.');
    const result = await response.json() as { data: ContactRow[]; total: number };
    setRows(result.data); setTotal(result.total); setSkip(nextSkip); setApplied(filters);
  }
  async function browse(nextSkip: number, filters = applied) {
    setBusy(true); setMessage('');
    try { await load(nextSkip, filters); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo consultar.'); }
    finally { setBusy(false); }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || !canEdit || busy) return;
    const modifying = editing !== 'new';
    const phone = fields.phone.replace(/[\s()-]/g, '');
    const body = {
      name: fields.name.trim(),
      ...(fields.email.trim() ? { email: fields.email.trim() } : {}),
      ...(phone ? { phone } : {}),
      ...(prospect ? { source: fields.source.trim(), status: fields.status, ...(fields.notes.trim() ? { notes: fields.notes.trim() } : {}) } : fields.taxId.trim() ? { taxId: fields.taxId.trim() } : {}),
      ...(modifying ? { expectedUpdatedAt: editing.updatedAt } : {}),
    };
    if (phone && !/^\+?[1-9]\d{7,14}$/.test(phone)) { setMessage('El teléfono debe contener entre 8 y 15 dígitos; puedes incluir + al inicio.'); return; }
    setBusy(true); setMessage('');
    try {
      const response = await fetch(`/api/crm/${slug}${modifying ? '/' + encodeURIComponent(editing.id) : ''}`, { method: modifying ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!response.ok) {
        const result = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(errorMessages[result.error ?? ''] ?? 'No se pudo guardar. Inténtalo de nuevo.');
      }
      setEditing(null);
      const filters = { query: '', status: '' };
      setQuery(''); setStatus('');
      try { await load(0, filters); setMessage(`${prospect ? 'Prospecto' : 'Cliente'} ${modifying ? 'actualizado' : 'creado'}.`); }
      catch { setMessage('El registro se guardó. Actualiza el listado para verlo; no lo captures otra vez.'); }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo guardar.'); }
    finally { setBusy(false); }
  }
  const readonly = !canEdit || busy;
  return <>
    <div className="contact-toolbar"><p>Datos reales de tu equipo · {total} registro{total === 1 ? '' : 's'}</p>{canEdit ? <button className="button" disabled={busy} onClick={() => open('new')}>Nuevo {singular}</button> : <span className="badge">Acceso de consulta</span>}</div>
    <p role="status" aria-live="polite">{message}</p>
    {editing ? <section className="document-panel" aria-labelledby="contact-editor"><div className="contact-toolbar"><h2 id="contact-editor" ref={editorRef} tabIndex={-1}>{editing === 'new' ? `Nuevo ${singular}` : canEdit ? `Editar ${singular}` : `Ficha de ${singular}`}</h2><button className="text-button" type="button" disabled={busy} onClick={() => setEditing(null)}>Cerrar ficha</button></div><form className="contact-form" onSubmit={save}>
      <label>Nombre completo<input ref={nameRef} value={fields.name} onChange={event => field('name', event.target.value)} required maxLength={250} autoComplete="name" readOnly={readonly}/></label>
      <label>Correo electrónico <span className="optional">Opcional</span><input type="email" value={fields.email} onChange={event => field('email', event.target.value)} maxLength={254} autoComplete="email" readOnly={readonly}/></label>
      <label>Teléfono <span className="optional">Opcional</span><input type="tel" value={fields.phone} onChange={event => field('phone', event.target.value)} maxLength={30} autoComplete="tel" readOnly={readonly} placeholder="+52…"/></label>
      {prospect ? <><label>Origen<input value={fields.source} onChange={event => field('source', event.target.value)} required maxLength={250} readOnly={readonly} placeholder="Referido, WhatsApp, sitio web…"/></label><label>Estado de seguimiento<select value={fields.status} onChange={event => field('status', event.target.value)} disabled={readonly}>{prospectStatuses.map(value => <option key={value} value={value}>{statusLabels[value]}</option>)}</select></label><label className="contact-notes">Notas <span className="optional">Opcional</span><textarea value={fields.notes} onChange={event => field('notes', event.target.value)} maxLength={5000} rows={4} readOnly={readonly}/></label></> : <label>RFC <span className="optional">Opcional</span><input value={fields.taxId} onChange={event => field('taxId', event.target.value)} maxLength={250} readOnly={readonly}/></label>}
      {editing !== 'new' ? <p className="lead-small contact-notes">Registrado: {new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City', dateStyle: 'medium' }).format(new Date(editing.createdAt))}</p> : null}
      {canEdit ? <div className="contact-notes"><button className="button" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button><button type="button" className="text-button" disabled={busy} onClick={() => setEditing(null)}>Cancelar</button></div> : null}
    </form></section> : null}
    <form className="access-form" onSubmit={event => { event.preventDefault(); void browse(0, { query: query.trim(), status }); }}><label>Buscar por nombre, correo o teléfono<input type="search" value={query} onChange={event => setQuery(event.target.value)} maxLength={100} disabled={busy}/></label>{prospect ? <label>Estado<select value={status} onChange={event => setStatus(event.target.value)} disabled={busy}><option value="">Todos los estados</option>{prospectStatuses.map(value => <option key={value} value={value}>{statusLabels[value]}</option>)}</select></label> : null}<button className="button" disabled={busy}>Buscar</button><button className="text-button" type="button" disabled={busy} onClick={() => void browse(skip)}>Actualizar listado</button></form>
    <div className="table-wrap"><table><caption className="document-caption">{applied.query ? `Resultados para “${applied.query}”` : prospect ? 'Prospectos del equipo' : 'Clientes del equipo'}{applied.status ? ` · ${statusLabels[applied.status as keyof typeof statusLabels]}` : ''}</caption><thead><tr><th>Nombre</th><th>Contacto</th><th>{prospect ? 'Seguimiento' : 'RFC'}</th><th>Acción</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td>{row.name}</td><td>{row.email || 'Sin correo'}<small className="document-type">{row.phone || 'Sin teléfono'}</small></td><td>{prospect ? <>{row.status ? statusLabels[row.status] : 'Nuevo'}<small className="document-type">{row.source}</small></> : row.taxId || 'Sin registrar'}</td><td><button className="text-button" disabled={busy} onClick={() => open(row)}>{canEdit ? 'Editar' : 'Ver ficha'}<span className="sr-only"> de {row.name}</span></button></td></tr>)}{rows.length === 0 ? <tr><td colSpan={4}>No hay registros en este listado.{canEdit ? ` Usa “Nuevo ${singular}” para comenzar.` : ''}</td></tr> : null}</tbody></table></div>
    <div className="document-pagination"><button className="text-button" disabled={busy || skip === 0} onClick={() => void browse(Math.max(0, skip - 20))}>Anterior</button><span>{total ? `${skip + 1}–${Math.min(skip + 20, total)} de ${total}` : '0 registros'}</span><button className="text-button" disabled={busy || skip + 20 >= total} onClick={() => void browse(skip + 20)}>Siguiente</button></div>
  </>;
}
