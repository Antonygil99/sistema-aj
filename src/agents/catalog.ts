// The eight single-purpose assistants of the Ruta de implementación IA AJ v1. Pure and browser-safe: the assistants
// page lists them and the server builds each one from its prompt (prompts.ts) and its tools (tools.ts). An assistant
// reads the CRM through its tools and only proposes changes; a person confirms every write, and anything that leaves
// the CRM (email, WhatsApp) still needs its own click.
export const toolNames = [
  'buscar_clientes', 'ver_expediente', 'buscar_polizas', 'buscar_recibos', 'buscar_prospectos', 'buscar_siniestros',
  'avisos_pendientes', 'resumen_metricas', 'tablero_entregas', 'actividades_pendientes', 'catalogo_productos', 'agenda',
  'guia_sistema', 'mensajes_whatsapp', 'estado_ficha_cliente', 'preparar_ficha_cliente',
  'crear_actividad', 'registrar_prospecto', 'mover_prospecto', 'resolver_aviso', 'preparar_correo',
] as const;
export type ToolName = (typeof toolNames)[number];
// Tools that change something: the assistant proposes, the user confirms in the chat.
export const writeTools: readonly ToolName[] = ['preparar_ficha_cliente', 'crear_actividad', 'registrar_prospecto', 'mover_prospecto', 'resolver_aviso', 'preparar_correo'];
export const isWriteTool = (name: string) => (writeTools as readonly string[]).includes(name);
export type AgentDefinition = { id: string; name: string; short: string; purpose: string; icon: string; tools: readonly ToolName[]; suggestions: readonly string[] };
const reading = ['buscar_clientes', 'ver_expediente'] as const;
export const agents = [
  {
    id: 'primer-contacto', name: 'Primer contacto por WhatsApp', icon: 'Messages2',
    short: 'Responde, pide lo mínimo o escala a Ale.',
    purpose: 'Prepara respuestas de primer contacto para WhatsApp siguiendo la regla de oro: resolver, pedir solo los datos mínimos o derivar a Ale. Registra prospectos a partir de una conversación.',
    tools: [...reading, 'buscar_prospectos', 'catalogo_productos', 'mensajes_whatsapp', 'estado_ficha_cliente', 'preparar_ficha_cliente', 'registrar_prospecto', 'crear_actividad'],
    suggestions: ['Me escribió alguien preguntando por un seguro de gastos médicos para su familia, ¿qué le contesto?', 'Te pego una conversación de WhatsApp: registra al prospecto con sus datos.', '¿Qué mensajes de WhatsApp llegaron hoy?'],
  },
  {
    id: 'captura-cotizacion', name: 'Captura para cotización', icon: 'ClipboardText',
    short: 'Diagnóstico de 5 preguntas y datos para cotizar.',
    purpose: 'Guía el diagnóstico de las cinco preguntas, ordena los datos que faltan para cotizar y avanza al prospecto en el embudo.',
    tools: [...reading, 'buscar_prospectos', 'catalogo_productos', 'registrar_prospecto', 'mover_prospecto', 'crear_actividad'],
    suggestions: ['¿Qué prospectos tienen el diagnóstico incompleto?', '¿Qué datos me faltan para cotizar a mi último prospecto?', 'Muéstrame el embudo de prospectos de esta semana.'],
  },
  {
    id: 'entrega-poliza', name: 'Entrega de póliza', icon: 'TaskSquare',
    short: 'Entrega activa: checklist y seguimientos 7/30/90.',
    purpose: 'Acompaña la entrega activa: que el cliente reciba, entienda y sepa usar su póliza, y que los seguimientos a 7, 30 y 90 días ocurran.',
    tools: [...reading, 'tablero_entregas', 'buscar_polizas', 'actividades_pendientes', 'crear_actividad', 'preparar_correo'],
    suggestions: ['¿Qué pólizas siguen sin entregar?', '¿Qué seguimientos de entrega tengo atrasados?', 'Prepara el correo de entrega para el cliente de mi última póliza emitida.'],
  },
  {
    id: 'renovaciones-pagos', name: 'Renovaciones y pagos', icon: 'Refresh2',
    short: 'Vencimientos, recibos y avisos por resolver.',
    purpose: 'Vigila renovaciones a 30, 20 y 10 días y recibos a 20 y 10 días y el día que vencen; prepara avisos y registra cómo se avisó al cliente.',
    tools: [...reading, 'buscar_polizas', 'buscar_recibos', 'avisos_pendientes', 'resolver_aviso', 'preparar_correo', 'crear_actividad'],
    suggestions: ['¿Qué pólizas vencen en los próximos 30 días?', '¿Qué avisos de renovación tengo pendientes?', '¿Qué recibos vencen esta semana?'],
  },
  {
    id: 'siniestros-orientacion', name: 'Siniestros y orientación médica', icon: 'Health',
    short: 'Seguimiento de siniestros y cómo usar la póliza.',
    purpose: 'Da seguimiento a los siniestros abiertos y orienta sobre el proceso para usar la póliza, sin diagnosticar ni determinar cobertura; deriva a Ale lo que lo requiera.',
    tools: [...reading, 'buscar_siniestros', 'buscar_polizas', 'estado_ficha_cliente', 'preparar_ficha_cliente', 'crear_actividad', 'preparar_correo'],
    suggestions: ['¿Qué siniestros siguen abiertos y desde cuándo?', 'Un cliente tuvo un accidente, ¿qué le pido y qué pasos sigue?', 'Prepara el seguimiento semanal de un siniestro abierto.'],
  },
  {
    id: 'contenidos-guiones', name: 'Contenidos y guiones', icon: 'VideoPlay',
    short: 'Ideas, guiones y publicaciones a partir de casos.',
    purpose: 'Convierte casos y preguntas frecuentes en ideas de contenido y guiones (anónimos), sin prometer coberturas.',
    tools: ['resumen_metricas', 'buscar_siniestros', 'catalogo_productos', 'guia_sistema'],
    suggestions: ['Dame 5 ideas de contenido sobre por qué revisar tu póliza antes de renovar.', 'Escribe un guion de 30 segundos para explicar qué hacer en una urgencia médica.', '¿Qué temas se repiten en los siniestros para hacer contenido?'],
  },
  {
    id: 'analisis-casos', name: 'Análisis de casos', icon: 'Chart',
    short: 'Cartera, embudo y casos con números reales.',
    purpose: 'Analiza la cartera, el embudo, la cobranza, las entregas y casos concretos con datos del CRM y propone siguientes pasos.',
    tools: [...reading, 'resumen_metricas', 'buscar_polizas', 'buscar_recibos', 'buscar_prospectos', 'buscar_siniestros', 'tablero_entregas', 'avisos_pendientes', 'actividades_pendientes'],
    suggestions: ['¿Cómo va la cartera este mes comparada con el anterior?', '¿En qué etapa del embudo se están quedando los prospectos?', 'Analiza el expediente de un cliente y dime qué atender primero.'],
  },
  {
    id: 'aprendizaje-interno', name: 'Aprendizaje interno AJ', icon: 'Teacher',
    short: 'Cómo se usa el CRM y la Ruta AJ.',
    purpose: 'Explica al equipo cómo usar el CRM y la Ruta de implementación AJ con lo que está documentado; dice cuando algo aún no lo está.',
    tools: ['guia_sistema', 'catalogo_productos', 'agenda'],
    suggestions: ['¿Cómo convierto un prospecto en cliente?', '¿Qué significan las etapas de la entrega activa?', '¿Cómo funcionan los avisos a clientes?'],
  },
] as const satisfies readonly AgentDefinition[];
export type AgentId = (typeof agents)[number]['id'];
export function agentById(id: string): AgentDefinition | null { return agents.find(agent => agent.id === id) ?? null; }
export const isAgentId = (value: unknown): value is AgentId => typeof value === 'string' && agents.some(agent => agent.id === value);
