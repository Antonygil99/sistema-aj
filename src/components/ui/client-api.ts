'use client';
// Browser-side API calls: one place for JSON handling, Spanish error messages and security signals.
export type Issue = { code?: string; message?: string; path?: (string | number)[] };
export class ApiError extends Error {
  constructor(public readonly code: string, public readonly status: number, message: string, public readonly issues: Issue[] = []) { super(message); }
}
export const errorMessages: Record<string, string> = {
  INVALID_INPUT: 'Revisa los datos marcados e inténtalo de nuevo.',
  INVALID_JSON: 'La solicitud no se pudo leer. Recarga la página.',
  ALREADY_EXISTS: 'Ya existe un registro con ese identificador o nombre.',
  RELATED_RECORD_NOT_FOUND: 'El registro vinculado ya no existe. Elige otro.',
  RECORD_CHANGED: 'Otra persona modificó este registro. Conservamos tu borrador: recarga la ficha antes de guardar.',
  RECORD_NOT_FOUND: 'El registro ya no está disponible.',
  HAS_RELATIONS: 'No se puede eliminar porque tiene información vinculada. Archívalo en su lugar.',
  ALREADY_IN_STATE: 'El registro ya estaba en ese estado. Actualiza el listado.',
  INVALID_STATUS: 'Ese estado no es válido para este módulo.',
  UNAUTHORIZED: 'Tu sesión terminó. Vuelve a entrar con Google.',
  FORBIDDEN: 'Tu cuenta no tiene permiso para esta acción.',
  INVALID_ORIGIN: 'Bloqueamos una solicitud de un origen no reconocido.',
  AUTH_NOT_CONFIGURED: 'El acceso no está configurado. Contacta al administrador.',
  SERVICE_UNAVAILABLE: 'El servicio no respondió. Inténtalo en unos segundos.',
  MODULE_NOT_FOUND: 'Este módulo no existe.',
  USE_DOCUMENT_UPLOAD: 'Los documentos se registran subiendo el archivo.',
  FILE_SIZE_INVALID: 'Máximo 4 MB por archivo.',
  FILE_TYPE_INVALID: 'Formato compatible: PDF, JPG, PNG, WEBP, MP3, OGG, WAV o MP4.',
  FILE_CONTENT_INVALID: 'El contenido no coincide con el formato del archivo.',
  FILE_NAME_INVALID: 'El nombre del archivo no es válido.',
  FILE_REQUIRED: 'Elige un archivo.',
  FORM_INVALID: 'El formulario de carga no es válido.',
  MULTIPART_REQUIRED: 'El formulario de carga no es válido.',
  MULTIPART_INVALID: 'El archivo llegó incompleto. Inténtalo de nuevo.',
  FOLDER_NOT_FOUND: 'La carpeta ya no existe. Actualiza la página.',
  FOLDER_NOT_EMPTY: 'Solo se pueden eliminar carpetas vacías.',
  FOLDER_SCOPE_MISMATCH: 'La carpeta debe pertenecer al mismo expediente que el archivo.',
  DOCUMENT_NOT_FOUND: 'El archivo ya no está disponible.',
  FILE_NOT_FOUND: 'El archivo no se encuentra en el almacenamiento.',
  NETWORK: 'Sin conexión con el servidor. Revisa tu red.',
  USE_CONVERSION: 'Para pasar un prospecto a cliente usa «Convertir en cliente».',
  ALREADY_CONVERTED: 'Este prospecto ya se convirtió en cliente.',
};
export const securityCodes = new Set(['UNAUTHORIZED', 'FORBIDDEN', 'INVALID_ORIGIN']);
// Custom (business) issues are already written in Spanish; Zod's built-in ones are not, so name the field instead.
export function issueMessage(issues: Issue[] | undefined, labels: Record<string, string> = {}) {
  const issue = issues?.[0];
  if (!issue) return errorMessages.INVALID_INPUT;
  if (issue.code === 'custom' && issue.message) return issue.message;
  const field = issue.path?.[0];
  return typeof field === 'string' && labels[field] ? `Revisa el campo «${labels[field]}».` : errorMessages.INVALID_INPUT;
}
export function messageFor(code: string) { return errorMessages[code] ?? 'No se pudo completar la operación.'; }
export function signalSecurity(code: string) {
  if (securityCodes.has(code) && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('aj:security', { detail: { code } }));
}
export async function apiFetch<T = unknown>(url: string, init: RequestInit & { json?: unknown; labels?: Record<string, string> } = {}): Promise<T> {
  const { json, labels, headers, ...rest } = init;
  let response: Response;
  try {
    response = await fetch(url, { cache: 'no-store', ...rest, headers: { ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers }, body: json !== undefined ? JSON.stringify(json) : rest.body });
  } catch { throw new ApiError('NETWORK', 0, errorMessages.NETWORK); }
  const body = await response.json().catch(() => ({})) as { error?: string; issues?: Issue[] } & T;
  if (!response.ok) {
    const code = body.error ?? 'SERVICE_UNAVAILABLE';
    signalSecurity(code);
    throw new ApiError(code, response.status, code === 'INVALID_INPUT' ? issueMessage(body.issues, labels) : messageFor(code), body.issues ?? []);
  }
  return body;
}
