'use client';
import { useState } from 'react';
type Grant = { id: string; email: string; role: 'USER' | 'ADMIN' | 'SUPERADMIN'; enabled: boolean };
export function UserManager({ initial }: { initial: Grant[] }) {
  const [grants, setGrants] = useState(initial);
  const [email,setEmail] = useState('');
  const [role,setRole] = useState<'USER' | 'ADMIN'>('USER');
  const [pending,setPending] = useState(false);
  const [message,setMessage] = useState('');
  async function save(input: { email: string; role: 'USER' | 'ADMIN'; enabled: boolean }) {
    setPending(true); setMessage('');
    try {
      const response = await fetch('/api/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
      if(!response.ok) throw new Error('SAVE_FAILED');
      const { data } = await response.json() as { data: Grant };
      setGrants(current => current.some(g => g.id === data.id) ? current.map(g => g.id === data.id ? data : g) : [...current,data]);
      setEmail(''); setMessage('Acceso guardado.');
    } catch { setMessage('No se pudo guardar. Comprueba tu sesión e inténtalo de nuevo.'); }
    finally { setPending(false); }
  }
  return <><form className="access-form" onSubmit={event => { event.preventDefault(); void save({ email, role, enabled: true }); }}><label>Correo de Google<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required maxLength={254}/></label><label>Rol<select value={role} onChange={e=>setRole(e.target.value as 'USER' | 'ADMIN')}><option value="USER">Usuario · Consulta</option><option value="ADMIN">Administrador · Operación CRM</option></select></label><button className="button" disabled={pending}>Añadir acceso</button></form><p role="status">{message}</p><div className="table-wrap"><table><thead><tr><th>Cuenta</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{grants.map(g=><tr key={g.id}><td>{g.email}</td><td>{{ USER: 'Usuario', ADMIN: 'Administrador', SUPERADMIN: 'Superadmin' }[g.role]}</td><td>{g.enabled ? 'Activo' : 'Desactivado'}</td><td>{g.role === 'SUPERADMIN' ? 'Cuenta principal protegida' : <><button disabled={pending} className="text-button" onClick={()=>void save({ email: g.email, role: g.role as 'USER' | 'ADMIN', enabled: !g.enabled })}>{g.enabled ? 'Desactivar' : 'Activar'}</button><button disabled={pending} className="text-button" onClick={()=>void save({ email:g.email, role:g.role === 'ADMIN' ? 'USER' : 'ADMIN', enabled:g.enabled })}>{g.role === 'ADMIN' ? 'Cambiar a usuario' : 'Cambiar a administrador'}</button></>}</td></tr>)}</tbody></table></div><p className="lead-small">Mientras el acceso de Google esté en pruebas, añade las cuentas nuevas también a sus usuarios de prueba.</p></>;
}
