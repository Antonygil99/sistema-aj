import { diagnosisProgress, diagnosisQuestions, prospectStages, stageLabels, stageMessage } from '../prospectos/pipeline';
// Shared, serializable-free description of each CRM table: used by the API (search, nullable fields)
// and by the browser (columns, forms, labels). Keep it free of server imports.
export type ResourceSlug = 'prospectos' | 'clientes' | 'polizas' | 'cotizaciones' | 'pagos' | 'renovaciones' | 'siniestros' | 'actividades' | 'productos';
export type RelationSlug = 'prospectos' | 'clientes' | 'polizas' | 'siniestros' | 'productos';
export type Row = Record<string, unknown> & { id: string; createdAt: string; updatedAt: string; archivedAt?: string | null };
export type Tone = 'neutral' | 'green' | 'blue' | 'sand' | 'lilac' | 'red';
export type Field = {
  name: string; label: string; required?: boolean; section?: string;
  // Options listed only while they are the current value (e.g. CLIENTE, reachable only through conversion).
  hiddenOptions?: string[]; maxLength?: number; placeholder?: string; hint?: string; wide?: boolean;
  // 'owner' picks a teammate (stored as email); 'image' is uploaded separately after saving the record.
  type: 'text' | 'textarea' | 'email' | 'tel' | 'money' | 'currency' | 'date' | 'select' | 'relation' | 'owner' | 'image';
  options?: Record<string, string>; relation?: RelationSlug; defaultValue?: string;
  // Only shown (and sent) while another field has one of these values.
  showWhen?: { field: string; values: string[] };
};
export type Column = { label: string; value: (row: Row) => string; detail?: (row: Row) => string; tone?: (row: Row) => Tone };
export type ResourceConfig = {
  slug: ResourceSlug; singular: string; plural: string; article: 'un' | 'una'; illustration: string;
  emptyTitle: string; emptyMessage: string; searchHint: string;
  statuses?: Record<string, string>; statusTones?: Record<string, Tone>;
  fields: Field[]; columns: Column[]; title: (row: Row) => string;
  // 'cards' shows a visual catalog grid instead of a table; image(row) returns a thumbnail URL when there is one.
  layout?: 'table' | 'cards'; image?: (row: Row) => string | null; imageUpload?: (id: string) => string;
  // Filling a relation can prefill empty fields (e.g. a catalog product fills insurer and responsible).
  prefill?: (field: string, related: Row, values: Record<string, string>) => Record<string, string>;
  // Pipeline view: columns of the status field; progress(row) feeds the card bar; guide(status) is the stage's key message.
  board?: { columns: string[]; hidden: string }; progress?: (row: Row) => { done: number; total: number; label: string };
  guide?: (status: string) => string | null; modalLinks?: (row: Row) => { label: string; href: string; primary?: boolean }[];
  // Fields that become null when omitted in a full-form update.
  nullable: string[];
};

export const currencies = { MXN: 'MXN · Peso mexicano', USD: 'USD · Dólar' };
export const frequencies = { ONCE: 'Pago único', MONTHLY: 'Mensual', QUARTERLY: 'Trimestral', SEMIANNUAL: 'Semestral', ANNUAL: 'Anual' };
export const productLineLabels = { MEDICAL: 'Gastos médicos', AUTO: 'Autos', LIFE: 'Vida', HOME: 'Hogar', OTHER: 'Otro' };
const text = (value: unknown) => typeof value === 'string' && value.trim() ? value : '';
const nested = (row: Row, path: string) => path.split('.').reduce<unknown>((value, key) => value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined, row);
export function formatDate(value: unknown) {
  if (typeof value !== 'string' || !value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('es-MX', { timeZone: 'UTC', dateStyle: 'medium' }).format(date);
}
export function formatMoney(amount: unknown, currency: unknown = 'MXN') {
  const number = Number(amount);
  if (!Number.isFinite(number)) return '';
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: typeof currency === 'string' && /^[A-Z]{3}$/.test(currency) ? currency : 'MXN' }).format(number);
}
// Dates travel as UTC midnight so the calendar day never shifts with the viewer's time zone.
export function dateInputValue(value: unknown) { return typeof value === 'string' && value ? value.slice(0, 10) : ''; }
export function dateToApi(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : value; }

export const relationLabel: Record<RelationSlug, (row: Row) => string> = {
  prospectos: row => text(row.name),
  clientes: row => text(row.name),
  polizas: row => [text(row.number), text(nested(row, 'client.name'))].filter(Boolean).join(' · '),
  siniestros: row => [text(row.reference), text(nested(row, 'policy.number'))].filter(Boolean).join(' · '),
  productos: row => [text(row.name), text(row.insurer)].filter(Boolean).join(' · '),
};
const owner = (label = 'Responsable'): Field => ({ name: 'ownerEmail', label, type: 'owner', hint: 'Quién da seguimiento.' });
const contact: Column = { label: 'Contacto', value: row => text(row.email) || 'Sin correo', detail: row => text(row.phone) || 'Sin teléfono' };
const linked = (row: Row) => text(nested(row, 'prospect.name')) || text(nested(row, 'client.name')) || text(nested(row, 'policy.number')) || text(nested(row, 'claim.reference'));

export const resources: Record<ResourceSlug, ResourceConfig> = {
  prospectos: {
    slug: 'prospectos', singular: 'prospecto', plural: 'prospectos', article: 'un', illustration: 'prospectos',
    emptyTitle: 'Tu primera oportunidad empieza aquí', emptyMessage: 'Registra a las personas interesadas y acompáñalas de curiosas a clientes recomendadoras.', searchHint: 'Nombre, correo o teléfono',
    statuses: stageLabels,
    statusTones: { CURIOSO: 'lilac', DIAGNOSTICADO: 'blue', COMPARATIVO: 'sand', EMISION: 'green', CLIENTE: 'green', PERDIDO: 'red' },
    board: { columns: prospectStages.map(stage => stage.id), hidden: 'Los convertidos en cliente y los perdidos siguen en la vista de lista.' },
    progress: row => ({ done: diagnosisProgress(row), total: diagnosisQuestions.length, label: `Diagnóstico ${diagnosisProgress(row)}/${diagnosisQuestions.length}` }),
    guide: status => stageMessage(status),
    modalLinks: row => row.convertedClientId ? [{ label: 'Ver cliente', href: `/crm/clientes/${encodeURIComponent(String(row.convertedClientId))}` }]
      : row.status === 'PERDIDO' ? [] : [{ label: 'Convertir en cliente', href: `/crm/clientes/nuevo?prospect=${encodeURIComponent(row.id)}`, primary: row.status === 'EMISION' }],
    fields: [
      { name: 'name', label: 'Nombre completo', type: 'text', required: true, maxLength: 250 },
      { name: 'email', label: 'Correo electrónico', type: 'email', maxLength: 254 },
      { name: 'phone', label: 'Teléfono', type: 'tel', maxLength: 30, placeholder: '+52…', hint: 'De 8 a 15 dígitos; puede iniciar con +.' },
      { name: 'source', label: 'Origen', type: 'text', required: true, maxLength: 250, defaultValue: 'manual', placeholder: 'Referido, WhatsApp, sitio web…' },
      { name: 'status', label: 'Etapa', type: 'select', required: true, defaultValue: 'CURIOSO', hiddenOptions: ['CLIENTE'], hint: 'Al responder las 5 preguntas pasa solo a Diagnosticado.' },
      owner(),
      { name: 'referredByClientId', label: 'Referido por', type: 'relation', relation: 'clientes', hint: 'Cliente que lo recomendó.' },
      { name: 'notes', label: 'Notas', type: 'textarea', maxLength: 5000, wide: true },
      { name: 'diagProtect', label: diagnosisQuestions[0].question, type: 'textarea', maxLength: 2000, wide: true, section: 'Diagnóstico · 5 preguntas' },
      { name: 'diagDependents', label: diagnosisQuestions[1].question, type: 'textarea', maxLength: 2000, wide: true },
      { name: 'diagCare', label: diagnosisQuestions[2].question, type: 'text', maxLength: 2000, wide: true },
      { name: 'diagCoverage', label: '¿Tiene IMSS o una póliza actual?', type: 'text', maxLength: 2000, placeholder: 'IMSS, póliza actual, ninguna…' },
      { name: 'diagMedicalHistory', label: '¿Tiene antecedentes médicos?', type: 'select', options: { SI: 'Sí, existen', NO: 'No', NO_SABE: 'No lo sabe' }, hint: 'Solo si existen; nunca registres el detalle.' },
      { name: 'diagPain', label: diagnosisQuestions[4].question, type: 'select', wide: true, options: { PRIMA: 'Pagar una prima', DECIDIR: 'No poder decidir dónde atenderse', AMBAS: 'Ambas por igual' } },
    ],
    columns: [{ label: 'Nombre', value: row => text(row.name), detail: row => text(row.source) }, contact, { label: 'Diagnóstico', value: row => `${diagnosisProgress(row)}/${diagnosisQuestions.length}`, detail: row => text(nested(row, 'referredBy.name')) ? `Referido por ${text(nested(row, 'referredBy.name'))}` : '' }],
    title: row => text(row.name), nullable: ['email', 'phone', 'notes', 'ownerEmail', 'referredByClientId', 'diagProtect', 'diagDependents', 'diagCare', 'diagCoverage', 'diagMedicalHistory', 'diagPain'],
  },
  clientes: {
    slug: 'clientes', singular: 'cliente', plural: 'clientes', article: 'un', illustration: 'clientes',
    emptyTitle: 'Aún no hay clientes', emptyMessage: 'Cuando un prospecto contrate, regístralo aquí para reunir sus pólizas y documentos.', searchHint: 'Nombre, correo, teléfono o RFC',
    fields: [
      { name: 'name', label: 'Nombre completo', type: 'text', required: true, maxLength: 250 },
      { name: 'email', label: 'Correo electrónico', type: 'email', maxLength: 254 },
      { name: 'phone', label: 'Teléfono', type: 'tel', maxLength: 30, placeholder: '+52…', hint: 'De 8 a 15 dígitos; puede iniciar con +.' },
      { name: 'taxId', label: 'RFC', type: 'text', maxLength: 250 },
    ],
    columns: [{ label: 'Nombre', value: row => text(row.name) }, contact, { label: 'RFC', value: row => text(row.taxId) || 'Sin registrar' }],
    title: row => text(row.name), nullable: ['email', 'phone', 'taxId'],
  },
  polizas: {
    slug: 'polizas', singular: 'póliza', plural: 'pólizas', article: 'una', illustration: 'polizas',
    emptyTitle: 'Sin pólizas registradas', emptyMessage: 'Registra la cobertura de cada cliente con su vigencia y prima.', searchHint: 'Número, aseguradora, cliente, vehículo o placas',
    statuses: { ACTIVE: 'Activa', EXPIRED: 'Vencida', CANCELLED: 'Cancelada' }, statusTones: { ACTIVE: 'green', EXPIRED: 'sand', CANCELLED: 'red' },
    fields: [
      { name: 'number', label: 'Número completo de póliza (incluye prefijo y ceros)', type: 'text', required: true, maxLength: 250 },
      { name: 'clientId', label: 'Cliente', type: 'relation', relation: 'clientes', required: true },
      { name: 'productId', label: 'Producto del catálogo', type: 'relation', relation: 'productos', hint: 'Completa aseguradora, producto y responsable.' },
      { name: 'insurer', label: 'Aseguradora', type: 'text', required: true, maxLength: 250 },
      { name: 'product', label: 'Producto o ramo', type: 'text', required: true, maxLength: 250 },
      { name: 'coverage', label: 'Cobertura o plan', type: 'text', maxLength: 250, placeholder: 'Amplia, RC básica, Médica Vital…' },
      { name: 'premium', label: 'Prima total', type: 'money', required: true },
      { name: 'currency', label: 'Moneda', type: 'currency', required: true, defaultValue: 'MXN' },
      { name: 'paymentFrequency', label: 'Periodicidad de pago', type: 'select', options: frequencies },
      { name: 'startDate', label: 'Inicio de vigencia', type: 'date', required: true },
      { name: 'endDate', label: 'Fin de vigencia', type: 'date', required: true },
      { name: 'status', label: 'Estado', type: 'select', required: true, defaultValue: 'ACTIVE' },
      owner(),
      { name: 'vehicle', label: 'Vehículo', type: 'textarea', maxLength: 1000, wide: true, section: 'Vehículo (solo autos)' },
      { name: 'plates', label: 'Placas', type: 'text', maxLength: 250 },
      { name: 'vehicleUse', label: 'Uso del vehículo', type: 'text', maxLength: 250, placeholder: 'Particular, comercial, carga…' },
    ],
    columns: [
      { label: 'Póliza', value: row => text(row.number), detail: row => [text(row.insurer), text(row.product), text(row.coverage)].filter(Boolean).join(' · ') },
      { label: 'Cliente', value: row => text(nested(row, 'client.name')), detail: row => [text(row.vehicle).split('\n')[0], text(row.plates)].filter(Boolean).join(' · ') },
      { label: 'Vigencia', value: row => `${formatDate(row.startDate)} → ${formatDate(row.endDate)}` },
      { label: 'Prima', value: row => formatMoney(row.premium, row.currency) },
    ],
    title: row => text(row.number), nullable: ['paymentFrequency', 'productId', 'ownerEmail', 'coverage', 'vehicle', 'plates', 'vehicleUse'],
    prefill: (field, related, values) => field === 'productId' ? {
      ...(values.insurer ? {} : { insurer: text(related.insurer) }),
      ...(values.product ? {} : { product: text(related.name) }),
      ...(values.ownerEmail || !text(related.ownerEmail) ? {} : { ownerEmail: text(related.ownerEmail) }),
    } : {},
  },
  cotizaciones: {
    slug: 'cotizaciones', singular: 'cotización', plural: 'cotizaciones', article: 'una', illustration: 'cotizaciones',
    emptyTitle: 'Sin cotizaciones todavía', emptyMessage: 'Prepara propuestas para tus prospectos y clientes, y sigue su respuesta.', searchHint: 'Referencia, producto o nombre',
    statuses: { DRAFT: 'Borrador', SENT: 'Enviada', ACCEPTED: 'Aceptada', REJECTED: 'Rechazada' }, statusTones: { DRAFT: 'neutral', SENT: 'blue', ACCEPTED: 'green', REJECTED: 'red' },
    fields: [
      { name: 'reference', label: 'Referencia', type: 'text', required: true, maxLength: 250 },
      { name: 'product', label: 'Producto', type: 'text', required: true, maxLength: 250 },
      { name: 'prospectId', label: 'Prospecto', type: 'relation', relation: 'prospectos', hint: 'Elige un prospecto o un cliente, no ambos.' },
      { name: 'clientId', label: 'Cliente', type: 'relation', relation: 'clientes' },
      { name: 'amount', label: 'Importe', type: 'money', required: true },
      { name: 'currency', label: 'Moneda', type: 'currency', required: true, defaultValue: 'MXN' },
      { name: 'validUntil', label: 'Válida hasta', type: 'date' },
      { name: 'status', label: 'Estado', type: 'select', required: true, defaultValue: 'DRAFT' },
    ],
    columns: [
      { label: 'Cotización', value: row => text(row.reference), detail: row => text(row.product) },
      { label: 'Para', value: row => text(nested(row, 'prospect.name')) || text(nested(row, 'client.name')), detail: row => nested(row, 'prospect.name') ? 'Prospecto' : 'Cliente' },
      { label: 'Importe', value: row => formatMoney(row.amount, row.currency), detail: row => row.validUntil ? `Vigente hasta ${formatDate(row.validUntil)}` : '' },
    ],
    title: row => text(row.reference), nullable: ['prospectId', 'clientId', 'validUntil'],
  },
  pagos: {
    slug: 'pagos', singular: 'recibo', plural: 'recibos', article: 'un', illustration: 'pagos',
    emptyTitle: 'Sin recibos por cobrar', emptyMessage: 'Los recibos de cada póliza aparecerán aquí con su vencimiento y estado.', searchHint: 'Número de póliza o cliente',
    statuses: { PENDING: 'Pendiente', PAID: 'Pagado', OVERDUE: 'Vencido' }, statusTones: { PENDING: 'sand', PAID: 'green', OVERDUE: 'red' },
    fields: [
      { name: 'policyId', label: 'Póliza', type: 'relation', relation: 'polizas', required: true, wide: true },
      { name: 'amount', label: 'Importe', type: 'money', required: true },
      { name: 'currency', label: 'Moneda', type: 'currency', required: true, defaultValue: 'MXN' },
      { name: 'dueDate', label: 'Vencimiento', type: 'date', required: true },
      { name: 'status', label: 'Estado', type: 'select', required: true, defaultValue: 'PENDING' },
      { name: 'paidAt', label: 'Fecha de pago', type: 'date', required: true, showWhen: { field: 'status', values: ['PAID'] } },
    ],
    columns: [
      { label: 'Póliza', value: row => text(nested(row, 'policy.number')), detail: row => text(nested(row, 'policy.client.name')) },
      { label: 'Vencimiento', value: row => formatDate(row.dueDate), detail: row => row.paidAt ? `Pagado el ${formatDate(row.paidAt)}` : '' },
      { label: 'Importe', value: row => formatMoney(row.amount, row.currency) },
    ],
    title: row => `Recibo ${text(nested(row, 'policy.number'))} · ${formatDate(row.dueDate)}`.trim(), nullable: ['paidAt'],
  },
  renovaciones: {
    slug: 'renovaciones', singular: 'renovación', plural: 'renovaciones', article: 'una', illustration: 'renovaciones',
    emptyTitle: 'Ninguna renovación en puerta', emptyMessage: 'Programa las renovaciones para contactar a tiempo a cada cliente.', searchHint: 'Número de póliza, cliente o notas',
    statuses: { PENDING: 'Pendiente', CONTACTED: 'Contactado', RENEWED: 'Renovada', LOST: 'Perdida' }, statusTones: { PENDING: 'sand', CONTACTED: 'blue', RENEWED: 'green', LOST: 'red' },
    fields: [
      { name: 'policyId', label: 'Póliza', type: 'relation', relation: 'polizas', required: true, wide: true },
      { name: 'dueDate', label: 'Fecha de renovación', type: 'date', required: true },
      { name: 'status', label: 'Estado', type: 'select', required: true, defaultValue: 'PENDING' },
      { name: 'notes', label: 'Notas', type: 'textarea', maxLength: 5000, wide: true },
    ],
    columns: [
      { label: 'Póliza', value: row => text(nested(row, 'policy.number')), detail: row => text(nested(row, 'policy.client.name')) },
      { label: 'Renovación', value: row => formatDate(row.dueDate), detail: row => text(row.notes).slice(0, 80) },
    ],
    title: row => `Renovación ${text(nested(row, 'policy.number'))}`.trim(), nullable: ['notes'],
  },
  siniestros: {
    slug: 'siniestros', singular: 'siniestro', plural: 'siniestros', article: 'un', illustration: 'siniestros',
    emptyTitle: 'Sin siniestros reportados', emptyMessage: 'Cuando un cliente reporte un incidente, regístralo para acompañar su caso.', searchHint: 'Referencia, descripción o póliza',
    statuses: { OPEN: 'Abierto', IN_REVIEW: 'En revisión', CLOSED: 'Cerrado' }, statusTones: { OPEN: 'red', IN_REVIEW: 'sand', CLOSED: 'green' },
    fields: [
      { name: 'reference', label: 'Referencia', type: 'text', required: true, maxLength: 250 },
      { name: 'policyId', label: 'Póliza', type: 'relation', relation: 'polizas', required: true },
      { name: 'occurredAt', label: 'Fecha del incidente', type: 'date', required: true },
      { name: 'status', label: 'Estado', type: 'select', required: true, defaultValue: 'OPEN' },
      { name: 'description', label: 'Descripción', type: 'textarea', required: true, maxLength: 5000, wide: true },
    ],
    columns: [
      { label: 'Siniestro', value: row => text(row.reference), detail: row => text(row.description).slice(0, 80) },
      { label: 'Póliza', value: row => text(nested(row, 'policy.number')), detail: row => text(nested(row, 'policy.client.name')) },
      { label: 'Ocurrió', value: row => formatDate(row.occurredAt) },
    ],
    title: row => text(row.reference), nullable: [],
  },
  actividades: {
    slug: 'actividades', singular: 'actividad', plural: 'actividades', article: 'una', illustration: 'actividades',
    emptyTitle: 'Todo al día', emptyMessage: 'Anota llamadas, visitas y pendientes para que nada se quede atrás.', searchHint: 'Título o descripción',
    statuses: { PENDING: 'Pendiente', DONE: 'Completada' }, statusTones: { PENDING: 'sand', DONE: 'green' },
    fields: [
      { name: 'title', label: 'Título', type: 'text', required: true, maxLength: 250, wide: true },
      { name: 'dueDate', label: 'Fecha', type: 'date' },
      { name: 'status', label: 'Estado', type: 'select', required: true, defaultValue: 'PENDING' },
      owner(),
      { name: 'clientId', label: 'Cliente', type: 'relation', relation: 'clientes', hint: 'Vincula como máximo un expediente.' },
      { name: 'prospectId', label: 'Prospecto', type: 'relation', relation: 'prospectos' },
      { name: 'policyId', label: 'Póliza', type: 'relation', relation: 'polizas' },
      { name: 'claimId', label: 'Siniestro', type: 'relation', relation: 'siniestros' },
      { name: 'description', label: 'Descripción', type: 'textarea', maxLength: 5000, wide: true },
    ],
    columns: [
      { label: 'Actividad', value: row => text(row.title), detail: row => text(row.description).slice(0, 80) },
      { label: 'Fecha', value: row => formatDate(row.dueDate) || 'Sin fecha' },
      { label: 'Vinculada a', value: row => linked(row) || 'General' },
    ],
    title: row => text(row.title), nullable: ['description', 'dueDate', 'ownerEmail', 'prospectId', 'clientId', 'policyId', 'claimId'],
  },
  productos: {
    slug: 'productos', singular: 'producto', plural: 'productos', article: 'un', illustration: 'polizas', layout: 'cards',
    emptyTitle: 'Arma tu catálogo de productos', emptyMessage: 'Agrega cada producto con su imagen, aseguradora y datos básicos, empezando por Médica Vital.', searchHint: 'Nombre o aseguradora',
    fields: [
      { name: 'image', label: 'Imagen', type: 'image', wide: true, hint: 'PNG, JPG o WEBP de hasta 4 MB.' },
      { name: 'name', label: 'Nombre del producto', type: 'text', required: true, maxLength: 250, placeholder: 'Médica Vital' },
      { name: 'insurer', label: 'Aseguradora', type: 'text', required: true, maxLength: 250 },
      { name: 'line', label: 'Ramo', type: 'select', required: true, defaultValue: 'MEDICAL', options: productLineLabels },
      owner('Responsable por defecto'),
      { name: 'description', label: 'Descripción breve', type: 'textarea', maxLength: 600, wide: true, placeholder: 'Para quién es y qué resuelve.' },
      { name: 'highlights', label: 'Datos básicos del servicio', type: 'textarea', maxLength: 5000, wide: true, hint: 'Un dato por línea: coberturas, red médica, suma asegurada, deducible, contacto de emergencia…' },
    ],
    columns: [
      { label: 'Producto', value: row => text(row.name), detail: row => text(row.insurer) },
      { label: 'Ramo', value: row => productLineLabels[row.line as keyof typeof productLineLabels] ?? '' },
    ],
    title: row => text(row.name), nullable: ['description', 'highlights', 'ownerEmail'],
    imageUpload: id => `/api/products/${encodeURIComponent(id)}/image`,
    image: row => row.imageType ? `/api/products/${encodeURIComponent(row.id)}/image?v=${encodeURIComponent(row.updatedAt)}` : null,
  },
};
for (const config of Object.values(resources)) {
  const status = config.fields.find(field => field.name === 'status');
  if (status && config.statuses) status.options = config.statuses;
}
export function isResourceSlug(value: string): value is ResourceSlug { return Object.hasOwn(resources, value); }
// Turns form strings into an API body: trims, drops empty optional values and hidden fields, converts dates.
export function formToBody(config: ResourceConfig, values: Record<string, string>) {
  const body: Record<string, string> = {};
  for (const field of config.fields) {
    if (field.type === 'image') continue;
    if (field.showWhen && !field.showWhen.values.includes(values[field.showWhen.field] ?? '')) continue;
    let value = (values[field.name] ?? '').trim();
    if (field.type === 'tel') value = value.replace(/[\s()-]/g, '');
    if (field.type === 'money') value = value.replace(/[,\s$]/g, '');
    if (!value) continue;
    body[field.name] = field.type === 'date' ? dateToApi(value) : value;
  }
  return body;
}
export function rowToForm(config: ResourceConfig, row: Row | null) {
  return Object.fromEntries(config.fields.filter(field => field.type !== 'image').map(field => {
    const value = row?.[field.name];
    if (field.type === 'date') return [field.name, dateInputValue(value)];
    return [field.name, value === null || value === undefined ? (row ? '' : field.defaultValue ?? '') : String(value)];
  }));
}
