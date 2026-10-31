// Initial, deterministic routing. Messages are untrusted data, never tool instructions.
// No provider call, identity inference, database write or outgoing message happens here.
export const attentionAreas = {
  SALES: 'Ventas y cotización', RENEWAL: 'Renovaciones', PAYMENT: 'Pagos', CLAIM: 'Siniestros', ADMIN: 'Administración', COORDINATOR: 'Coordinador AJ',
} as const;
export type AttentionArea = keyof typeof attentionAreas;
export type MessageAssistance = {
  sourceMessageId: string; area: AttentionArea; areas: AttentionArea[];
  priority: 'NORMAL' | 'REVIEW' | 'URGENT'; line: 'AUTO' | 'MEDICAL' | 'LIFE' | 'MIXED' | null;
  reason: string; nextStep: string; draft: string | null; reviewNotes: string[];
  method: 'RULES_V1'; automaticSending: false;
};
const normalize = (value: string) => value.slice(0, 4096).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const rules: [AttentionArea, RegExp][] = [
  ['CLAIM', /\b(siniestro|accidente|choque|chocaron|reembolso|reclamacion|hospital|hospitalizado|hospitalizada|urgencia|urgencias|robo)\b/],
  ['RENEWAL', /\b(renovar|renovacion|renueva|renovarla|renovarlo|renovamos|vence|vencimiento|vigencia)\b/],
  ['PAYMENT', /\b(pagar|pago|pagos|pague|pagado|recibo|recibos|cobro|cobranza|mensualidad|comprobante|transferencia)\b/],
  ['ADMIN', /\b(endoso|domicilio|rfc|rehabilitacion|rehabilitar|tarjeta|cancelar|cancelacion|corregir|correccion|beneficiario|beneficiarios|caratula|documentos|documento|alta|baja)\b/],
  ['SALES', /\b(cotizar|cotizacion|cotizaciones|precio|contratar|contratacion|seguro|seguros|plan)\b/],
];
const drafts: Record<AttentionArea, string> = {
  SALES: 'Gracias por escribirnos. ¿Qué te gustaría proteger: auto, salud o vida? El asesor revisará contigo las opciones y los datos necesarios para cotizar.',
  RENEWAL: 'Gracias por tu mensaje. El asesor revisará tu póliza y la propuesta de renovación antes de compartirte las condiciones.',
  PAYMENT: 'Gracias por avisarnos. El asesor revisará el recibo y su aplicación con la aseguradora antes de confirmar el estado del pago. No compartas datos de tarjeta, contraseñas ni códigos por este chat.',
  CLAIM: 'Recibimos tu mensaje. Lo revisará el asesor para orientarte sobre el trámite con la aseguradora. Esta respuesta no confirma cobertura ni aceptación del caso.',
  ADMIN: 'Gracias por escribirnos. El asesor revisará qué cambio o documento necesitas y los requisitos de la aseguradora. No compartas datos bancarios, contraseñas ni códigos por este chat.',
  COORDINATOR: 'Gracias por escribirnos. ¿Necesitas ayuda con una cotización, tu póliza, un pago, una renovación o un siniestro?',
};
export function assistMessage(input: { id: string; kind: string; body: string }): MessageAssistance {
  const text = normalize(input.body), media = input.kind !== 'text';
  const urgent = /\b(urgente|urgencia|urgencias|emergencia|hospital|hospitalizado|hospitalizada|heridos|herido|no respira|peligro inmediato)\b/.test(text);
  const sensitive = /\b(cobertura|cubierto|cubre|deducible|coaseguro|indemnizacion|diagnostico|tratamiento|medicamento|rechazo|rechazaron|clabe|cvv|nip|contrasena|codigo de seguridad|tarjeta)\b/.test(text);
  let areas = rules.filter(([, rule]) => rule.test(text)).map(([area]) => area);
  // Generic "seguro" doesn't supersede a concrete service request.
  if (areas.length > 1 && !/\b(cotizar|cotizacion|cotizaciones|precio|contratar|contratacion)\b/.test(text)) areas = areas.filter(area => area !== 'SALES');
  if (!areas.length) areas = ['COORDINATOR'];
  if (urgent && !areas.includes('CLAIM')) areas.unshift('CLAIM');
  const area = areas[0];
  const lines = [ /\b(auto|autos|coche|carro|vehiculo|vehiculos)\b/.test(text) ? 'AUTO' : null,
    /\b(gmm|salud|medico|medicos|hospital|hospitalizado|hospitalizada)\b/.test(text) ? 'MEDICAL' : null,
    /\bvida\b/.test(text) ? 'LIFE' : null ].filter(Boolean) as ('AUTO' | 'MEDICAL' | 'LIFE')[];
  const reviewNotes = ['La clasificación es orientativa y usa reglas; no ejecuta agentes ni confirma hechos de la póliza.'];
  if (media) reviewNotes.push('Archivo pendiente de revisión humana. No se descargó, transcribió ni leyó su contenido; solo se considera el texto adjunto.');
  if (areas.length > 1) reviewNotes.push('Hay varios motivos posibles. El asesor debe confirmar el principal.');
  if (sensitive) reviewNotes.push('Requiere revisión del asesor. No confirmar coberturas, pagos, tratamientos ni solicitar datos bancarios o credenciales.');
  reviewNotes.push('El número remitente no verifica identidad ni autoriza compartir un expediente o sus documentos.');
  const nextSteps: Record<AttentionArea, string> = {
    SALES: 'Confirmar el interés y revisar si ya existe el contacto antes de crear un prospecto.',
    RENEWAL: 'Seleccionar la póliza verificada, preparar el comparativo y obtener revisión antes de comunicar condiciones.',
    PAYMENT: 'Revisar el recibo concreto y la aplicación ante la aseguradora. Un comprobante no confirma el pago.',
    CLAIM: 'Avisar al responsable de esta bandeja y confirmar el procedimiento aplicable con la aseguradora.',
    ADMIN: 'Confirmar el tipo de solicitud y revisar el trámite y sus requisitos antes de preparar documentos.',
    COORDINATOR: 'Leer el mensaje y confirmar qué necesita la persona antes de derivar o consultar datos del CRM.',
  };
  return { sourceMessageId: input.id, area, areas, priority: urgent ? 'URGENT' : media || sensitive || area === 'CLAIM' || area === 'COORDINATOR' || areas.length > 1 ? 'REVIEW' : 'NORMAL',
    line: lines.length > 1 ? 'MIXED' : lines[0] ?? null,
    reason: urgent ? 'Posible urgencia: priorizar atención humana.' : media ? 'Se recibió multimedia; su contenido necesita revisión.' : areas.length > 1 ? 'El texto contiene varios motivos de atención.' : area === 'COORDINATOR' ? 'No hay un motivo claro en el texto.' : 'El texto contiene una referencia a este motivo de atención.',
    nextStep: urgent ? 'Avisar de inmediato al responsable de esta bandeja. No esperar una respuesta de IA ni confirmar cobertura.' : nextSteps[area],
    draft: urgent ? 'Tu mensaje requiere atención inmediata del asesor. Si hay peligro inmediato, contacta los servicios de emergencia de tu localidad. Este chat no es un servicio de emergencias.' : media && !text.trim() ? null : drafts[area],
    reviewNotes, method: 'RULES_V1', automaticSending: false };
}
export const assistanceExamples = [
  { id: 'demo-sales', label: 'Cotización de auto', kind: 'text', body: 'Quiero cotizar un seguro para mi auto.' },
  { id: 'demo-renewal', label: 'Renovación', kind: 'text', body: 'Mi póliza de vida vence pronto, quiero renovarla.' },
  { id: 'demo-payment', label: 'Comprobante de pago', kind: 'image', body: 'Te envío el comprobante del pago del recibo.' },
  { id: 'demo-claim', label: 'Posible urgencia', kind: 'text', body: 'Es urgente, tuve un accidente y hay heridos.' },
  { id: 'demo-admin', label: 'Cambio de domicilio', kind: 'text', body: 'Necesito un endoso para cambiar el domicilio de mi póliza.' },
  { id: 'demo-audio', label: 'Audio sin transcripción', kind: 'audio', body: '' },
  { id: 'demo-mixed', label: 'Varios motivos', kind: 'text', body: 'Quiero renovar el seguro del auto y revisar el pago de un recibo.' },
  { id: 'demo-unknown', label: 'Mensaje sin contexto', kind: 'text', body: 'Hola, ¿me ayudas con una duda?' },
] as const;
