'use client';
import { useRef, useState, type FormEvent } from 'react';

export type DocumentRow = { id: string; name: string; mimeType: string; createdAt: string; client: { name: string } | null; policy: { number: string } | null; claim: { reference: string } | null };
export type DocumentOption = { id: string; label: string; kind: 'clientId' | 'policyId' | 'claimId' };
const accept = '.pdf,.jpg,.jpeg,.png,.webp,.mp3,.ogg,.wav,.mp4';
const errors: Record<string, string> = {
  FILE_SIZE_INVALID: 'El archivo debe pesar entre 1 byte y 4 MB.',
  FILE_TYPE_INVALID: 'Elige PDF, JPG, PNG, WEBP, MP3, OGG, WAV o MP4.',
  FILE_CONTENT_INVALID: 'El contenido no coincide con el tipo de archivo. Exporta el archivo en un formato compatible.',
  RELATED_RECORD_NOT_FOUND: 'El expediente ya no existe. Actualiza la página.',
  UNAUTHORIZED: 'Tu sesión terminó. Vuelve a entrar con Google.',
  FORBIDDEN: 'Tu cuenta tiene permiso de consulta. Para subir archivos necesitas ser administrador.',
};
export function DocumentLibrary({ initial, initialTotal, options, canUpload, configured, configurationMessage }: { initial: DocumentRow[]; initialTotal: number; options: DocumentOption[]; canUpload: boolean; configured: boolean; configurationMessage?: string }) {
  const [rows, setRows] = useState(initial);
  const [total, setTotal] = useState(initialTotal);
  const [skip, setSkip] = useState(0);
  const [search, setSearch] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [attachment, setAttachment] = useState('');
  async function load(nextSkip: number, query: string) {
    const response = await fetch(`/api/documents?take=20&skip=${nextSkip}&q=${encodeURIComponent(query)}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('No se pudo actualizar el listado. Comprueba tu sesión.');
    const result = await response.json() as { data: DocumentRow[]; total: number };
    setRows(result.data); setTotal(result.total); setSkip(nextSkip); setActiveQuery(query);
  }
  async function changePage(nextSkip: number, query = activeQuery) {
    setBusy(true); setMessage('');
    try { await load(nextSkip, query); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo consultar.'); }
    finally { setBusy(false); }
  }
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) { setMessage('Selecciona un archivo.'); return; }
    if (!file.size || file.size > 4 * 1024 * 1024) { setMessage(errors.FILE_SIZE_INVALID); return; }
    setBusy(true); setMessage('');
    const form = new FormData(); form.set('file', file);
    const selected = options.find(option => `${option.kind}:${option.id}` === attachment);
    if (selected) form.set(selected.kind, selected.id);
    try {
      const response = await fetch('/api/documents', { method: 'POST', body: form });
      if (!response.ok) {
        const result = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(errors[result.error ?? ''] ?? 'No se pudo subir el archivo. Comprueba la conexión e inténtalo de nuevo.');
      }
      if (fileRef.current) fileRef.current.value = '';
      setSearch('');
      // A successful upload must not be reported as failed if only the list refresh fails.
      try { await load(0, ''); setMessage('Archivo guardado de forma privada.'); }
      catch { setMessage('Archivo guardado. Actualiza el listado para verlo; no necesitas subirlo otra vez.'); }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo subir.'); }
    finally { setBusy(false); }
  }
  return <>
    <p className="notice">Archivos privados del equipo. Usuarios: consulta y descarga. Administradores: carga de archivos. Máximo 4 MB por archivo.</p>
    {!configured ? <p role="alert" className="notice">{configurationMessage || 'El almacenamiento no está disponible. Un administrador debe revisar la configuración de R2.'}</p> : null}
    {canUpload ? <section className="document-panel" aria-labelledby="upload-heading"><h2 id="upload-heading">Añadir un archivo</h2><form className="access-form" onSubmit={upload}>
      <label>Archivo<input ref={fileRef} type="file" accept={accept} required disabled={busy || !configured} aria-describedby="file-help"/></label>
      <label>Expediente<select value={attachment} onChange={event => setAttachment(event.target.value)} disabled={busy || !configured}><option value="">Archivo general del equipo</option>{options.map(option => <option key={`${option.kind}:${option.id}`} value={`${option.kind}:${option.id}`}>{option.label}</option>)}</select></label>
      <button className="button" disabled={busy || !configured}>{busy ? 'Procesando…' : 'Subir archivo'}</button>
    </form><p id="file-help" className="lead-small">PDF, JPG, PNG, WEBP, MP3, OGG, WAV o MP4. Puedes asociarlo a un cliente, póliza o siniestro. El selector incluye los 100 registros más recientes de cada tipo.</p></section> : null}
    <form className="access-form" onSubmit={event => { event.preventDefault(); void changePage(0, search); }}><label>Buscar por nombre<input type="search" value={search} onChange={event => setSearch(event.target.value)} maxLength={100}/></label><button className="button" disabled={busy}>Buscar</button></form>
    <p role="status" aria-live="polite">{message}</p>
    <div className="table-wrap"><table><caption className="document-caption">{total} archivo{total === 1 ? '' : 's'} · {activeQuery ? `Búsqueda: ${activeQuery}` : 'Biblioteca del equipo'}</caption><thead><tr><th>Archivo</th><th>Expediente</th><th>Fecha</th><th>Acción</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td>{row.name}<small className="document-type">{row.mimeType}</small></td><td>{row.client?.name ?? row.policy?.number ?? row.claim?.reference ?? 'General'}</td><td>{new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City', dateStyle: 'medium' }).format(new Date(row.createdAt))}</td><td>{configured ? <a className="text-button" href={`/api/documents/${encodeURIComponent(row.id)}/download`} referrerPolicy="no-referrer">Descargar<span className="sr-only"> {row.name}</span></a> : 'No disponible'}</td></tr>)}{rows.length === 0 ? <tr><td colSpan={4}>No hay archivos en este listado.</td></tr> : null}</tbody></table></div>
    <div className="document-pagination"><button className="text-button" disabled={busy || skip === 0} onClick={() => void changePage(Math.max(0, skip - 20))}>Anterior</button><span>{total ? `${skip + 1}–${Math.min(skip + 20, total)} de ${total}` : '0 archivos'}</span><button className="text-button" disabled={busy || skip + 20 >= total} onClick={() => void changePage(skip + 20)}>Siguiente</button></div>
  </>;
}
