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
    running.current = true; setBusy(true); setMessage('Actualizando pagos y renovaciones en Google Calendar…');
    try {
      for (let batch = 0; batch < 30; batch++) {
        const payments = await apiFetch<{ changed: number; more: boolean; running: boolean }>('/api/calendar/payments', { method: 'POST' });
        const renewals = await apiFetch<{ changed: number; more: boolean; running: boolean }>('/api/calendar/renewals', { method: 'POST' });
        if (payments.running || renewals.running) { setMessage('Hay una sincronización en curso. Puedes actualizar en unos momentos.'); return; }
        if (!payments.more && !renewals.more) { setMessage('Pagos y renovaciones actualizados en tu calendario principal de Google.'); return; }
      }
      setMessage('Se guardó el avance. Pulsa Sincronizar calendario para continuar.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo sincronizar. Revisa la conexión con Google.'); }
    finally { running.current = false; setBusy(false); }
  }
  useEffect(() => {
    if (!connected) return;
    const timer = window.setTimeout(() => void sync(), 0);
    return () => window.clearTimeout(timer);
  }, [connected]);
  return <section className="document-panel"><h2>Pagos y renovaciones en Google Calendar</h2>
    <p className="lead-small">Los vencimientos de tus pólizas y recibos pendientes se muestran como eventos de día completo, con enlace al expediente. Cada pago incluye importe y moneda. Se actualizan diariamente y al abrir esta agenda.</p>
    <p className="lead-small">Los recibos vencidos conservan su fecha original. Al confirmar o archivar un recibo, su evento se retira en la próxima sincronización. Las notificaciones usan tus ajustes de Google; los avisos por correo conservan su configuración.</p>
    <button className="text-button" type="button" disabled={!connected || busy} onClick={() => void sync()}><Refresh2 aria-hidden="true"/>{busy ? 'Sincronizando…' : 'Sincronizar calendario'}</button>
    <a className="text-button" href="https://calendar.google.com/" target="_blank" rel="noopener noreferrer">Abrir Google Calendar</a>
    {message ? <p role="status">{message}</p> : null}
  </section>;
}
