'use client';
import { useState } from 'react';
import { Add } from 'iconsax-reactjs';
import { apiFetch } from './ui/client-api';
import { useConfirm } from './ui/confirm';
import { Modal } from './ui/modal';
import { useToast } from './ui/toast';
type Grant = { id: string; email: string; role: 'USER' | 'ADMIN' | 'SUPERADMIN'; enabled: boolean };
const roleLabels = { USER: 'Usuario', ADMIN: 'Administrador', SUPERADMIN: 'Superadmin' };
export function UserManager({ initial }: { initial: Grant[] }) {
  const [grants, setGrants] = useState(initial);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'USER' | 'ADMIN'>('USER');
  const [pending, setPending] = useState(false);
  const [adding, setAdding] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();
  async function save(input: { email: string; role: 'USER' | 'ADMIN'; enabled: boolean }, success: string) {
    setPending(true);
    try {
      const { data } = await apiFetch<{ data: Grant }>('/api/users', { method: 'PATCH', json: input, labels: { email: 'Correo de Google' } });
      setGrants(current => current.some(grant => grant.id === data.id) ? current.map(grant => grant.id === data.id ? data : grant) : [...current, data]);
      toast({ kind: input.enabled ? 'success' : 'security', title: success, message: data.email });
      return true;
    } catch (error) { toast({ kind: 'error', title: 'No se guardó el acceso', message: error instanceof Error ? error.message : undefined }); return false; }
    finally { setPending(false); }
  }
  async function toggle(grant: Grant) {
    if (grant.enabled && !await confirm({ title: 'Desactivar acceso', message: `${grant.email} perderá el acceso de inmediato y sus sesiones abiertas se cerrarán. Podrás reactivarlo después.`, confirmLabel: 'Desactivar', tone: 'danger' })) return;
    await save({ email: grant.email, role: grant.role as 'USER' | 'ADMIN', enabled: !grant.enabled }, grant.enabled ? 'Acceso desactivado' : 'Acceso reactivado');
  }
  async function changeRole(grant: Grant) {
    const next = grant.role === 'ADMIN' ? 'USER' : 'ADMIN';
    if (!await confirm({ title: 'Cambiar rol', message: next === 'ADMIN' ? `${grant.email} podrá crear, editar y archivar registros del CRM.` : `${grant.email} pasará a solo consulta y descarga.`, confirmLabel: `Cambiar a ${roleLabels[next].toLowerCase()}` })) return;
    await save({ email: grant.email, role: next, enabled: grant.enabled }, 'Rol actualizado');
  }
  return <>
    <div className="resource-toolbar"><span className="resource-count">{grants.length} cuenta{grants.length === 1 ? '' : 's'} autorizada{grants.length === 1 ? '' : 's'}</span><button type="button" className="button" onClick={() => setAdding(true)}><Add aria-hidden="true"/>Añadir acceso</button></div>
    <div className="table-wrap"><table><thead><tr><th>Cuenta</th><th>Rol</th><th>Estado</th><th><span className="sr-only">Acciones</span></th></tr></thead><tbody>{grants.map(grant => <tr key={grant.id}>
      <td>{grant.email}</td><td>{roleLabels[grant.role]}</td><td><span className={`status-pill tone-${grant.enabled ? 'green' : 'red'}`}>{grant.enabled ? 'Activo' : 'Desactivado'}</span></td>
      <td className="row-actions">{grant.role === 'SUPERADMIN' ? <small>Cuenta principal protegida</small> : <><button type="button" disabled={pending} className={`text-button${grant.enabled ? ' is-danger' : ''}`} onClick={() => void toggle(grant)}>{grant.enabled ? 'Desactivar' : 'Activar'}</button><button type="button" disabled={pending} className="text-button" onClick={() => void changeRole(grant)}>{grant.role === 'ADMIN' ? 'Cambiar a usuario' : 'Cambiar a administrador'}</button></>}</td>
    </tr>)}</tbody></table></div>
    <p className="lead-small">Mientras el acceso de Google esté en pruebas, añade las cuentas nuevas también a sus usuarios de prueba.</p>
    <Modal open={adding} onClose={() => setAdding(false)} busy={pending} size="sm" title="Añadir acceso" description="La persona entrará con su cuenta de Google."
      footer={<><span className="modal-footer-spacer"/><button type="button" className="text-button" disabled={pending} onClick={() => setAdding(false)}>Cancelar</button><button type="submit" form="access-form" className="button" disabled={pending}>Añadir acceso</button></>}>
      <form id="access-form" className="resource-form" onSubmit={async event => { event.preventDefault(); if (await save({ email: email.trim(), role, enabled: true }, 'Acceso añadido')) { setEmail(''); setAdding(false); } }}>
        <div className="form-field is-wide"><label><span className="form-label">Correo de Google</span><input data-autofocus type="email" value={email} onChange={event => setEmail(event.target.value)} required maxLength={254} autoComplete="off"/></label></div>
        <div className="form-field is-wide"><label><span className="form-label">Rol</span><select value={role} onChange={event => setRole(event.target.value as 'USER' | 'ADMIN')}><option value="USER">Usuario · Consulta y descarga</option><option value="ADMIN">Administrador · Operación del CRM</option></select></label></div>
      </form>
    </Modal>
  </>;
}
