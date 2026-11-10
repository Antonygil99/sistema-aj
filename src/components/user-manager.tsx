'use client';
import {businessLines,businessLineLabels,type BusinessLine} from '@/modules/areas/policy';

import {Select} from '@/components/ui/select';

import { useState } from 'react';
import { Add } from '@/components/icons';
import { FcGoogle } from 'react-icons/fc';
import { Avatar } from './ui/avatar';
import { apiFetch } from './ui/client-api';
import { useConfirm } from './ui/confirm';
import { Modal } from './ui/modal';
import { useToast } from './ui/toast';
type Grant = { id: string; email: string; role: 'USER' | 'ADMIN' | 'SUPERADMIN'; enabled: boolean; name?: string | null; image?: string | null;productLines?:BusinessLine[] };
const roleLabels = { USER: 'Usuario', ADMIN: 'Administrador', SUPERADMIN: 'Superadmin' };
export function UserManager({ initial }: { initial: Grant[] }) {
  const [grants, setGrants] = useState(initial);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'USER' | 'ADMIN'>('USER');
  const [pending, setPending] = useState(false);
  const [adding, setAdding] = useState(false);
  const [areaGrant,setAreaGrant]=useState<Grant|null>(null),[areas,setAreas]=useState<BusinessLine[]>([]);
  const toast = useToast();
  const confirm = useConfirm();
  async function save(input: { email: string; role: 'USER' | 'ADMIN'; enabled: boolean;productLines?:BusinessLine[] }, success: string) {
    setPending(true);
    try {
      const { data } = await apiFetch<{ data: Grant }>('/api/users', { method: 'PATCH', json: input, labels: { email: 'Correo de Google' } });
      setGrants(current => current.some(grant => grant.id === data.id) ? current.map(grant => grant.id === data.id ? { ...grant, ...data } : grant) : [...current, data]);
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
    <Modal open={!!areaGrant} onClose={()=>setAreaGrant(null)} busy={pending} size="sm" title="Áreas de trabajo" description={areaGrant?.name||areaGrant?.email} footer={<><button type="button" className="text-button" onClick={()=>setAreaGrant(null)} disabled={pending}>Cancelar</button><button type="button" className="button" disabled={pending||!areaGrant} onClick={async()=>{if(areaGrant&&await save({email:areaGrant.email,role:areaGrant.role as 'USER'|'ADMIN',enabled:areaGrant.enabled,productLines:areas},'Áreas actualizadas'))setAreaGrant(null);}}>Guardar áreas</button></>}>
      <p>El catálogo y los datos básicos de clientes se comparten. Cada cuenta opera únicamente los ramos seleccionados.</p><div className="resource-form">{businessLines.map(line=><label key={line} className="mcp-check"><input type="checkbox" checked={areas.includes(line)} disabled={pending} onChange={e=>setAreas(current=>e.target.checked?[...current,line]:current.filter(item=>item!==line))}/>{businessLineLabels[line]}</label>)}</div>
      {areas.length?<label className="form-field"><span className="form-label">Seguro predeterminado al crear</span><Select value={areas[0]} disabled={pending} onChange={e=>setAreas(current=>[e.target.value as BusinessLine,...current.filter(line=>line!==e.target.value)])}>{areas.map(line=><option key={line} value={line}>{businessLineLabels[line]}</option>)}</Select><small className="form-hint">Puede elegir otro ramo en cada oportunidad.</small></label>:null}
      {!areas.length?<p className="notice">Sin áreas asignadas podrá consultar el catálogo y los contactos, pero no las operaciones de seguros.</p>:null}
    </Modal>
    <div className="resource-toolbar"><span className="resource-count">{grants.length} cuenta{grants.length === 1 ? '' : 's'} autorizada{grants.length === 1 ? '' : 's'}</span><button type="button" className="button" onClick={() => setAdding(true)}><Add aria-hidden="true"/>Añadir acceso</button></div>
    <div className="table-wrap"><table><thead><tr><th>Cuenta</th><th>Rol</th><th>Estado</th><th><span className="sr-only">Acciones</span></th></tr></thead><tbody>{grants.map(grant => <tr key={grant.id}>
      <td><GoogleAccount grant={grant}/><small>{grant.role==='SUPERADMIN'?'Todas las áreas':grant.productLines?.map(line=>businessLineLabels[line]).join(' · ')||'Sin áreas asignadas'}</small></td><td>{roleLabels[grant.role]}</td><td><span className={`status-pill tone-${grant.enabled ? 'green' : 'red'}`}>{grant.enabled ? 'Activo' : 'Desactivado'}</span></td>
      <td className="row-actions">{grant.role === 'SUPERADMIN' ? <small>Cuenta principal protegida</small> : <><button type="button" className="text-button" disabled={pending} onClick={()=>{setAreaGrant(grant);setAreas(grant.productLines??[]);}}>Áreas de trabajo</button><button type="button" disabled={pending} className={`text-button${grant.enabled ? ' is-danger' : ''}`} onClick={() => void toggle(grant)}>{grant.enabled ? 'Desactivar' : 'Activar'}</button><button type="button" disabled={pending} className="text-button" onClick={() => void changeRole(grant)}>{grant.role === 'ADMIN' ? 'Cambiar a usuario' : 'Cambiar a administrador'}</button></>}</td>
    </tr>)}</tbody></table></div>
    <p className="lead-small">Mientras el acceso de Google esté en pruebas, añade las cuentas nuevas también a sus usuarios de prueba.</p>
    <Modal open={adding} onClose={() => setAdding(false)} busy={pending} size="sm" title="Añadir acceso" description="La persona entrará con su cuenta de Google."
      footer={<><span className="modal-footer-spacer"/><button type="button" className="text-button" disabled={pending} onClick={() => setAdding(false)}>Cancelar</button><button type="submit" form="access-form" className="button" disabled={pending}>Añadir acceso</button></>}>
      <form id="access-form" className="resource-form" onSubmit={async event => { event.preventDefault(); if (await save({ email: email.trim(), role, enabled: true }, 'Acceso añadido')) { setEmail(''); setAdding(false); } }}>
        <div className="form-field is-wide"><label><span className="form-label">Correo de Google</span><input data-autofocus type="email" value={email} onChange={event => setEmail(event.target.value)} required maxLength={254} autoComplete="off"/></label></div>
        <div className="form-field is-wide"><label><span className="form-label">Rol</span><Select value={role} onChange={event => setRole(event.target.value as 'USER' | 'ADMIN')}><option value="USER">Usuario · Consulta y descarga</option><option value="ADMIN">Administrador · Operación del CRM</option></Select></label></div>
      </form>
    </Modal>
  </>;
}
// Google profile photo (or initials before the first sign-in) with the Google mark on top.
function GoogleAccount({ grant }: { grant: Grant }) {
  return <div className="google-account">
    <span className="google-avatar">
      <Avatar name={grant.name} email={grant.email} image={grant.image} size={34}/>
      <span className="google-mark" title="Cuenta de Google"><FcGoogle aria-hidden="true"/></span>
    </span>
    <span className="google-account-text">{grant.name ? <strong>{grant.name}</strong> : null}<span>{grant.email}</span>{!grant.name ? <small>Aún no ha iniciado sesión</small> : null}</span>
  </div>;
}
