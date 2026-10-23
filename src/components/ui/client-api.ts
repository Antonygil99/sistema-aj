'use client';
// Browser-side API calls: one place for JSON handling, Spanish error messages and security signals.
export type Issue = { code?: string; message?: string; path?: (string | number)[] };
export class ApiError extends Error {
  constructor(public readonly code: string, public readonly status: number, message: string, public readonly issues: Issue[] = []) { super(message); }
}
export const errorMessages: Record<string, string> = {
  WA_NOT_FOUND: 'La conversación ya no está disponible.',
  WA_TOKEN_INVALID: 'Meta indica que el token es inválido, caducó o fue revocado. Sustituye WHATSAPP_ACCESS_TOKEN en Vercel y vuelve a desplegar.',
  WA_PERMISSION_MISSING: 'Meta indica que falta un permiso para operar con esta cuenta. Revisa los permisos de WhatsApp y el acceso del token al número.',
  WA_RECIPIENT_NOT_ALLOWED: 'El destinatario no está en la lista permitida del número de prueba. Agrégalo y verifícalo en Meta → Paso 1: Pruébalo; revisa también su formato internacional.',
  WA_NUMBER_NOT_REGISTERED: 'Meta indica que el número de envío no está registrado en la API. Revisa el Phone Number ID y la cuenta seleccionada antes de registrar o migrar un número.',
  WA_ACCOUNT_RESTRICTED: 'Meta restringió esta cuenta. Revisa su estado en WhatsApp Manager.',
  WA_ACCOUNT_PAYMENT: 'Meta indica un problema de elegibilidad de pago de la cuenta. Revisa la facturación en WhatsApp Manager.',
  WA_ACCOUNT_ACCESS: 'No se pudo confirmar el acceso al número empresarial configurado. Revisa el Phone Number ID y su cuenta en Meta.',
  WA_CONNECTION_UNAVAILABLE: 'Meta no respondió a la comprobación. No se envió ningún mensaje; puedes comprobar de nuevo.',
  WA_SEND_NOT_CONFIGURED: 'Falta configurar el envío para este número empresarial.',
  WA_WINDOW_CLOSED: 'Pasaron 24 horas desde el último mensaje del contacto. Necesitas una plantilla aprobada.',
  WA_REQUEST_CONFLICT: 'Esta solicitud ya corresponde a otro mensaje. Actualiza la conversación.',
  WA_IN_PROGRESS: 'Este mensaje ya se está enviando. Espera su confirmación.',
  WA_DELIVERY_UNCERTAIN: 'No podemos confirmar el envío. No lo reenvíes: revisa la entrega en Meta antes de continuar.',
  WA_SEND_REJECTED: 'Meta rechazó el envío. Revisa la vigencia del token, permisos y destinatario antes de reintentar.',
  SESSION_REQUIRED: 'Entra con tu cuenta de Google para gestionar tu calendario.',
  CALENDAR_NOT_CONNECTED: 'Conecta Google Calendar para continuar.',
  CALENDAR_RECONNECT: 'Vuelve a conectar Google Calendar para renovar el permiso.',
  CALENDAR_PERMISSION: 'Google rechazó el acceso. Comprueba que Calendar API esté habilitada y autoriza el permiso de calendario al reconectar.',
  CALENDAR_UNAVAILABLE: 'Google Calendar no respondió. Puedes reintentar sin duplicar la reunión.',
  CALENDAR_RATE_LIMIT: 'Google limitó temporalmente las solicitudes. Espera un momento y vuelve a intentar.',
  CALENDAR_EVENT_INVALID: 'Google no aceptó la reunión. Revisa los datos o desmarca Google Meet si tu cuenta no lo admite.',
  CALENDAR_EVENT_NOT_FOUND: 'La reunión ya no está disponible en tu agenda.',
  CALENDAR_EVENT_CHANGED: 'La reunión cambió o ya se está cancelando. Actualiza la agenda antes de continuar.',
  CALENDAR_ACTIVITY_NOT_FOUND: 'La actividad ya no está pendiente o no está asignada a tu cuenta.',
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
  EMAIL_NOT_CONFIGURED: 'El envío de correos no está configurado. Avisa al administrador.',
  EMAIL_UNAVAILABLE: 'El servicio de correo no respondió. Intenta de nuevo en un momento.',
  EMAIL_RATE_LIMITED: 'Se alcanzó el límite de envíos de correo por ahora. Intenta más tarde.',
  EMAIL_REJECTED: 'El servicio de correo rechazó el mensaje. Revisa los destinatarios y los adjuntos.',
  EMAIL_IN_PROGRESS: 'Este correo ya se está enviando.',
  EMAIL_RECIPIENT_NOT_ALLOWED: 'Solo puedes escribir al correo del cliente o a sus contactos registrados.',
  EMAIL_DOCUMENT_NOT_ALLOWED: 'Uno de los archivos ya no está disponible o pertenece a otro expediente.',
  EMAIL_DOCUMENT_UNAVAILABLE: 'No se pudo leer uno de los archivos del almacenamiento.',
  EMAIL_ATTACHMENTS_TOO_LARGE: 'Los adjuntos superan 20 MB en total. Envía menos archivos.',
  AI_NOT_CONFIGURED: 'Los asistentes aún no están configurados. Avisa al administrador.',
  AI_ANTHROPIC_NOT_CONFIGURED: 'Falta la llave de Anthropic para el modelo elegido. Configúrala o elige un modelo de OpenAI en Preferencias.',
  AI_OPENAI_NOT_CONFIGURED: 'Falta la llave de OpenAI para el modelo elegido. Configúrala o elige un modelo de Claude en Preferencias.',
  AI_RATE_LIMITED: 'Los asistentes recibieron demasiadas solicitudes. Intenta en un momento.',
  AI_REJECTED: 'El asistente no pudo procesar la solicitud. Intenta reformularla.',
  AI_UNAVAILABLE: 'El asistente no respondió. Intenta de nuevo en un momento.',
  ACCION_NO_PERMITIDA: 'Esa acción no se puede ejecutar desde un asistente.',
  CLIENTE_NO_ENCONTRADO: 'El cliente ya no existe.',
  PROSPECTO_NO_ENCONTRADO: 'El prospecto ya no existe o ya es cliente.',
  AVISO_NO_ENCONTRADO: 'El aviso ya no existe.',
  NOTICE_NOT_FOUND: 'El aviso ya no existe. Actualiza la página.',
  NOTICE_ALREADY_RESOLVED: 'Alguien ya resolvió este aviso. Actualiza la página.',
  CONTACT_NOT_FOUND: 'El contacto ya no existe. Actualiza la página.',
  STORAGE_NOT_CONFIGURED: 'El almacenamiento de archivos no está disponible.',
  CLIENT_NOT_FOUND: 'El cliente ya no existe. Actualiza la página.',
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
  // Refresh the visible module's KPIs after a successful business mutation, without resetting forms.
  if (typeof window !== 'undefined' && rest.method && !['GET','HEAD'].includes(rest.method.toUpperCase()) && /^\/api\/(crm|dossiers|policies|documents|folders|products)(\/|$)/.test(url)) window.dispatchEvent(new CustomEvent('aj:metrics-changed'));
  return body;
}
