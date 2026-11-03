'use client';
import { useEffect, useRef, useState } from 'react';
import { apiFetch } from './ui/client-api';
import { Refresh2 } from './icons';

export function CalendarRenewals({ connected }: { connected: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const running = useRef(false);
  async function sync() {
    if (running.current) return;
    running.current = true; setBusy(true); setMessage('Actualizando tus renovaciones en Google Calendar…');
    try {
      for (let batch = 0; batch < 30; batch++) {
        const result = await apiFetch<{ changed: number; more: boolean; running: boolean }>('/api/calendar/renewals', { method: 'POST' });
        if (result.running) { setMessage('Hay una sincronización en curso. Puedes actualizar en unos momentos.'); return; }
        if (!result.more) { setMessage('Renovaciones actualizadas en tu calendario principal de Google.'); return; }
      }
      setMessage('Se guardó el avance. Pulsa Sincronizar renovaciones para continuar.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo sincronizar. Revisa la conexión con Google.'); }
    finally { running.current = false; setBusy(false); }
  }
  useEffect(() => {
    if (!connected) return;
    const timer = window.setTimeout(() => void sync(), 0);
    return () => window.clearTimeout(timer);
  }, [connected]);
  return <section className="document-panel"><h2>Renovaciones en Google Calendar</h2>
    <p className="lead-small">Tus pólizas vigentes asignadas tendrán un evento de día completo en su fecha de vencimiento, con enlace al expediente. Se actualizan diariamente y al abrir esta agenda. Los avisos por correo mantienen su configuración.</p>
    <p className="lead-small">Las notificaciones usan los ajustes de tu calendario. Cambia fechas y responsables desde la póliza; aquí no se envían invitaciones a clientes.</p>
    <button className="text-button" type="button" disabled={!connected || busy} onClick={() => void sync()}><Refresh2 aria-hidden="true"/>{busy ? 'Sincronizando…' : 'Sincronizar renovaciones'}</button>
    <a className="text-button" href="https://calendar.google.com/" target="_blank" rel="noopener noreferrer">Abrir Google Calendar</a>
    {message ? <p role="status">{message}</p> : null}
  </section>;
}
