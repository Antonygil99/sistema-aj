// Texts of the emails to clients: suggested defaults and the {placeholders} each one can use. The team edits them in
// Avisos → Plantillas (EmailTemplate); a kind without a saved text uses its default. Pure and free of zod (the
// editor and the composer import it); tested in tests/email.test.ts. The defaults avoid promises about coverage and
// Método AJ wording, which Ale defines.
export const templateKinds = ['BIENVENIDA', 'DOCUMENTOS', 'RENOVACION', 'PAGO', 'SINIESTRO'] as const;
export type TemplateKind = (typeof templateKinds)[number];
export type TemplateText = { subject: string; body: string };
export const placeholderLabels = {
  cliente: 'Nombre del cliente', asesor: 'Tu nombre', poliza: 'Número de póliza', producto: 'Producto', aseguradora: 'Aseguradora',
  vence: 'Fecha de vencimiento', dias: 'Días que faltan', monto: 'Importe del recibo', referencia: 'Referencia del siniestro',
} as const;
export type Placeholder = keyof typeof placeholderLabels;
export const templateInfo: Record<TemplateKind, { label: string; hint: string; placeholders: Placeholder[]; defaults: TemplateText }> = {
  BIENVENIDA: {
    label: 'Bienvenida', hint: 'Al dar de alta a un cliente; puede llevar su póliza y recibos.', placeholders: ['cliente', 'asesor'],
    defaults: { subject: 'Te damos la bienvenida a AJ Consultoría de Seguros', body: 'Hola {cliente}:\n\nGracias por confiar en nosotros. Desde hoy te acompañamos con tus seguros: cuando tengas una duda, un cambio o una urgencia, escríbenos y te ayudamos.\n\nTe compartimos tus documentos para que los tengas a la mano.\n\nSaludos,' },
  },
  DOCUMENTOS: {
    label: 'Documentos', hint: 'Pólizas, recibos o endosos que envías desde el expediente o Documentos.', placeholders: ['cliente', 'asesor'],
    defaults: { subject: 'Documentos de tu póliza', body: 'Hola {cliente}:\n\nTe compartimos los documentos adjuntos. Si algo no está claro, responde a este correo y lo revisamos contigo.\n\nSaludos,' },
  },
  RENOVACION: {
    label: 'Renovación', hint: 'Avisos a 30, 20 y 10 días del fin de vigencia.', placeholders: ['cliente', 'asesor', 'poliza', 'producto', 'aseguradora', 'vence', 'dias'],
    defaults: { subject: 'Tu póliza {poliza} vence el {vence}', body: 'Hola {cliente}:\n\nTu póliza {producto} con {aseguradora} ({poliza}) vence el {vence}. Queremos revisarla contigo antes de esa fecha para que la renovación salga a tiempo.\n\n¿Te parece si agendamos una llamada? Responde a este correo y te buscamos.\n\nSaludos,' },
  },
  PAGO: {
    label: 'Pago', hint: 'Avisos a 20 y 10 días del vencimiento de un recibo y el mismo día.', placeholders: ['cliente', 'asesor', 'poliza', 'producto', 'aseguradora', 'vence', 'dias', 'monto'],
    defaults: { subject: 'Recordatorio de pago de tu póliza {poliza}', body: 'Hola {cliente}:\n\nTe recordamos que el recibo de tu póliza {poliza} por {monto} vence el {vence}. Si ya lo pagaste, ignora este mensaje y gracias.\n\nSi necesitas los datos para pagar, responde a este correo.\n\nSaludos,' },
  },
  SINIESTRO: {
    label: 'Seguimiento de siniestro', hint: 'Cada semana mientras el siniestro siga abierto.', placeholders: ['cliente', 'asesor', 'poliza', 'referencia'],
    defaults: { subject: 'Seguimiento de tu siniestro {referencia}', body: 'Hola {cliente}:\n\nQueremos contarte cómo va tu siniestro {referencia} de la póliza {poliza}: [escribe aquí el estado actual].\n\nSi tienes documentos o dudas, responde a este correo.\n\nSaludos,' },
  },
};
export function isTemplateKind(value: unknown): value is TemplateKind { return typeof value === 'string' && (templateKinds as readonly string[]).includes(value); }
// Replaces {placeholder} with its value; unknown names stay visible so the sender notices them.
export function fillTemplate(text: string, values: Partial<Record<Placeholder, string>>) {
  return text.replace(/\{([a-z]+)\}/g, (match, name: string) => Object.hasOwn(values, name) && values[name as Placeholder] !== undefined ? values[name as Placeholder]! : match);
}
export function draftFor(kind: TemplateKind, saved: TemplateText | null, values: Partial<Record<Placeholder, string>>) {
  const text = saved ?? templateInfo[kind].defaults;
  return { subject: fillTemplate(text.subject, values).replace(/\s+/g, ' ').trim(), message: fillTemplate(text.body, values) };
}
// "[escribe aquí …]" marks text the sender must complete before sending (e.g. the claim's current status).
export const BLANK = /\[[^\]]*escribe[^\]]*\]/i;
export function unknownPlaceholders(text: string) {
  return [...new Set([...text.matchAll(/\{([a-z]+)\}/g)].map(match => match[1]).filter(name => !Object.hasOwn(placeholderLabels, name)))];
}
