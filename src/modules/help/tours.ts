import { modules, type ModuleSlug } from '../catalog';
import { resources, isResourceSlug } from '../resources/config';
// Guided tours for the Help Center. Pure (unit tested in tests/tours.test.ts): the browser resolves each
// step's first visible target and skips steps whose element is not on screen (role, view or empty list).
export type TourStep = { targets?: string[]; title: string; body: string; illustration?: 'intake' | 'procedures' | 'mcp' | 'imports' | 'mcpForms' | 'brokers' | 'renewal' | 'policy' | 'resources' };
export type Tour = { id: string; kind: 'component' | 'module' | 'feature'; title: string; summary: string; route?: string; context?: 'client' | 'procedure'; prepare?: 'intake' | 'procedures'; minRole?: 'ADMIN' | 'SUPERADMIN'; listed?: boolean; steps: TourStep[] };
type Role = 'USER' | 'ADMIN' | 'SUPERADMIN';
const rank: Record<Role, number> = { USER: 0, ADMIN: 1, SUPERADMIN: 2 };
const newButton = ['.resource-toolbar > .button'];
const filters = ['.resource-filters'];
const firstRecord = ['.resource-table tbody tr:first-child', '.resource-cards > :first-child', '.catalog-grid > :first-child'];
// Records live in ResourceManager tables: the same four steps explain any of them.
function tableSteps(slug: ModuleSlug): TourStep[] {
  if (!isResourceSlug(slug)) return [];
  const config = resources[slug];
  const article = config.article === 'una' ? 'una' : 'un';
  return [
    { targets: ['.resource-toolbar .segmented[role="tablist"]'], title: 'Activos y archivados', body: `Archivar oculta ${article} ${config.singular} sin borrarlo; lo encuentras aquí, en «Archivados», y lo puedes restaurar.` },
    { targets: newButton, title: `Registrar ${article} ${config.singular}`, body: 'Abre el formulario. Los campos obligatorios están marcados y, si algo falta, te lo señalamos debajo del campo.' },
    { targets: filters, title: 'Buscar y filtrar', body: `Busca por ${config.searchHint.charAt(0).toLowerCase() + config.searchHint.slice(1)}.${config.statuses ? ' También puedes filtrar por estado.' : ''}` },
    { targets: firstRecord, title: 'Abrir un registro', body: 'Toca el primer dato para ver el detalle o editarlo. Los íconos de la derecha editan o archivan.' },
  ];
}
const tips: Partial<Record<ModuleSlug, string>> = {
  polizas: 'Cada póliza pertenece a un expediente. Si eliges un producto del catálogo se completan la aseguradora, el producto y el responsable.',
  cotizaciones: 'Registra cada propuesta para un prospecto o cliente y sigue si se envió, se aceptó o se rechazó.',
  pagos: 'Los recibos vencidos aparecen en los avisos y en el resumen. Marca cada recibo como pagado al cobrarlo.',
  renovaciones: 'Las renovaciones que vencen en los próximos 7 días aparecen en los avisos del equipo.',
  siniestros: 'Da seguimiento a cada caso desde que se abre hasta que se cierra, ligado a su póliza.',
  actividades: 'Tareas y próximos pasos del equipo. Los seguimientos de 7, 30 y 90 días de cada entrega se crean aquí solos.',
  productos: 'El catálogo con imagen, aseguradora y responsable de cada producto. Al registrar una póliza puedes elegir uno.',
};
function moduleTour(slug: ModuleSlug): Tour {
  const entry = modules.find(item => item.slug === slug)!;
  const base = { id: `modulo:${slug}`, kind: 'module' as const, title: entry.label, summary: entry.description, route: `/crm/${slug}` };
  const intro = (body: string): TourStep => ({ title: entry.label, body });
  if (slug === 'prospectos') return { ...base, steps: [
    intro('Aquí sigues a cada prospecto por la Ruta AJ: curioso, diagnosticado, comparativo guiado y emisión.'),
    { targets: ['.resource-toolbar .segmented[aria-label="Forma de ver"]'], title: 'Embudo o lista', body: 'El embudo muestra a cada prospecto en su etapa; la lista sirve para buscar y filtrar por estado. Recordamos la vista que elijas.' },
    { targets: newButton, title: 'Registrar un prospecto', body: 'Captura sus datos y, cuando puedas, las 5 preguntas del diagnóstico. Al responderlas pasa solo a «Diagnosticado».' },
    { targets: ['.pipeline-board .pipeline-card'], title: 'Tarjeta del prospecto', body: 'Tócala para ver o editar. Dentro está «Convertir en cliente», que abre su expediente sin volver a capturar datos.' },
    { targets: ['.pipeline-board .pipeline-advance'], title: 'Avanza con un clic', body: 'Mueve al prospecto a la siguiente etapa y deja constancia en el historial del equipo.' },
    ...tableSteps('prospectos').slice(2),
  ] };
  if (slug === 'clientes') return { ...base, route: '/crm/clientes?view=dossiers', steps: [
    intro('Cada cliente tiene un expediente con sus pólizas, recibos y documentos.'),
    { targets: ['.dossier-grid .dossier-card'], title: 'Expedientes', body: 'Cada carpeta es un cliente. Ábrela para ver sus pólizas, su entrega activa, sus recibos y sus documentos.' },
    { targets: ['.resource-toolbar a[href="/crm/clientes/nuevo"]'], title: 'Nuevo expediente', body: 'Un asistente de 4 pasos crea al cliente, su primera póliza y su calendario de recibos de una sola vez.' },
    { targets: ['.resource-toolbar .segmented[aria-label="Forma de ver"]'], title: 'Expedientes o lista', body: 'La lista sirve para editar datos de contacto y archivar. Recordamos la vista que elijas.' },
    // In the list view the generic archive, search and open steps apply; the dossier view skips them.
    ...tableSteps('clientes').filter((_, index) => index !== 1),
  ] };
  if (slug === 'entregas') return { ...base, steps: [
    intro('Una póliza no termina al enviar el PDF: termina cuando el cliente sabe usarla. Este tablero sigue esa entrega.'),
    { targets: ['.delivery-board'], title: 'Etapas de la entrega', body: 'Emitida, entregada, explicada, seguimiento a 7 y 30 días y posible referido. Cada póliza vigente aparece en su etapa.' },
    { targets: ['.delivery-board .delivery-card'], title: 'Las cinco señales', body: 'Abre una tarjeta y marca si el cliente la recibió, la entendió, sabe a quién acudir, cuándo avisar y el primer paso en una urgencia.' },
    { targets: ['.resource-toolbar .segmented[aria-label="Responsable"]'], title: 'Solo las tuyas', body: 'Filtra las pólizas a tu cargo. Al marcar la entrega se programan seguimientos a 7, 30 y 90 días en Actividades.' },
  ] };
  if (slug === 'documentos') return { ...base, steps: [
    intro('La biblioteca privada del equipo y de cada expediente, organizada en carpetas.'),
    { targets: ['.drive-breadcrumb'], title: 'Dónde estás', body: 'La ruta de carpetas. Toca cualquier nivel para regresar.' },
    { targets: ['.dossier-grid .doc-folder', '.drive-area .row-link'], title: 'Tus carpetas', body: 'Usa ⋯ o clic derecho sobre una carpeta para renombrarla, cambiarle el color, archivarla o eliminarla. Clic derecho en un espacio vacío para crear una carpeta o subir archivos.' },
    { targets: ['.drive-archived'], title: 'Carpetas archivadas', body: 'Lo que archivas sale de la biblioteca con todo su contenido. Restáuralo desde aquí cuando lo necesites.' },
    { targets: ['.drive-toolbar button.button:not(.button-soft)'], title: 'Subir archivos', body: 'También puedes arrastrarlos a la ventana. Se suben en segundo plano aunque cambies de pantalla.' },
    { targets: ['.drive-toolbar .segmented'], title: 'Tarjetas o lista', body: 'Cambia la forma de ver los archivos. Recordamos la vista que elijas.' },
    { targets: filters, title: 'Buscar', body: 'Busca archivos y carpetas por nombre dentro de la carpeta abierta.' },
  ] };
  return { ...base, steps: [intro(tips[slug] ?? entry.description), ...tableSteps(slug)] };
}
export const tours: Tour[] = [
  {id:'funcion:brokers',kind:'feature',title:'Mi bandeja privada',summary:'Canales propios y preparación de la conexión.',route:'/whatsapp',steps:[
    {title:'Tu bandeja pertenece a tu cuenta',body:'Solo aparecen conversaciones de tus canales asignados. Un número pendiente de asociación conserva su historial y no se muestra a otros brokers.',illustration:'brokers'},
    {targets:['.wa-toolbar'],title:'Comprueba el estado',body:'Consultar el número confirma acceso de lectura en Meta. El envío se valida con una respuesta revisada; los números reales esperan su autorización correspondiente.'},
    {targets:['.wa-columns'],title:'Atención humana',body:'Lee, responde y marca resuelta la conversación. Los asistentes no responden automáticamente y los envíos ambiguos no se reintentan.'},
  ]},
  {id:'funcion:correos',kind:'feature',title:'Plantillas y correo individual',summary:'Formato, variables y tiempos por asesor.',route:'/avisos?tab=plantillas',minRole:'ADMIN',steps:[
    {title:'Un borrador antes de enviar',body:'Las plantillas son personales y los avisos se preparan para revisión. El recorrido no crea plantillas ni envía correos.',illustration:'resources'},
    {targets:['.notice-schedule-settings'],title:'Elige tus tiempos',body:'Ajusta anticipación de renovación, recibos y seguimiento de siniestros para tus pólizas. Los registros sin responsable usan los valores del sistema.'},
    {targets:['.template-list'],title:'Crea o copia una plantilla',body:'Usa Nueva plantilla o empieza desde un ejemplo. Puedes elegir una predeterminada por tipo de correo.'},
    {targets:['.rich-email-field'],title:'Inserta variables y da formato',body:'Pulsa un chip para insertarlo en el cursor. Usa negrita, cursiva, listas y enlaces HTTPS. La vista previa usa datos ficticios.'},
    {targets:['.template-form'],title:'Envía desde el expediente',body:'Abre Correos → Escribir correo, elige tu plantilla y, si hace falta, póliza o recibo. Revisa el destinatario y las variables antes de pulsar Enviar.'},
  ]},
  {id:'funcion:drive',kind:'feature',title:'Referencias de Google Drive',summary:'Conexión individual, carpeta compartida y vínculos de expediente.',route:'/drive',minRole:'ADMIN',steps:[
    {title:'Los originales permanecen en Drive',body:'El CRM consulta nombres y metadatos bajo tu autorización de Google. No copia archivos ni modifica permisos. El recorrido no conecta cuentas ni guarda referencias.',illustration:'resources'},
    {targets:['[data-feature="drive-connect"]'],title:'Autoriza tu cuenta',body:'Guarda la carpeta del equipo y autoriza Google con la misma cuenta que usas en AJ. Cada broker completa su propia autorización.'},
    {targets:['[data-feature="drive-browser"]'],title:'Vincula al expediente correcto',body:'Explora la raíz o sus subcarpetas, elige el cliente y vincula un archivo o carpeta. Google sigue controlando quién puede abrirlo. Vincular no autoriza entregarlo al cliente.'},
  ]},
  {id:'funcion:renovacion-preparada',kind:'feature',title:'Preparar una renovación',summary:'Aviso interno, comparación y revisión antes de comunicar.',route:'/crm/polizas',minRole:'ADMIN',steps:[
    {title:'El aviso llega primero al broker',body:'Prepara la documentación y compara importes antes de contactar al cliente. Este recorrido no guarda datos ni envía mensajes.',illustration:'renewal'},
    {targets:['.finance-panel > summary'],title:'Abre la póliza',body:'En Recibos, pagos y renovación, abre Preparar renovación y selecciona ambas carátulas dentro del expediente.'},
    {targets:['[data-feature="renovacion-preparada"]'],title:'Revisa la propuesta',body:'Compara primas totales en la misma moneda. Marca lista después de comprobar documentos; comunicar sigue siendo una acción humana.'},
  ]},
  {id:'funcion:caratula',kind:'feature',title:'Leer una carátula',summary:'Extraer, revisar y conservar el documento de origen.',route:'/crm/clientes/nuevo',minRole:'ADMIN',steps:[
    {title:'La lectura prepara datos',body:'En el paso de póliza abre Completar desde una carátula. Requiere tu proveedor de IA configurado y autorización para procesar el archivo.',illustration:'policy'},
    {targets:['[data-feature="caratula"]'],title:'Revisa la evidencia',body:'Carga un PDF de hasta 10 páginas o una imagen, máximo 4 MB. Revisa cada campo y su evidencia; la información incierta queda por capturar.'},
    {targets:['.wizard-actions'],title:'Confirma el formulario',body:'Conserva prefijos y ceros, confirma moneda y fechas y revisa recibos por separado. Al guardar se adjunta la carátula; la lectura no crea pólizas.'},
  ]},
  {id:'funcion:recursos',kind:'feature',title:'Organizar recursos',summary:'Herramientas internas y enlaces compartibles.',route:'/recursos',steps:[
    {title:'Un lugar para tus herramientas',body:'Encuentra enlaces de pago, calculadoras, comparativas y guías por nombre o aseguradora.',illustration:'resources'},
    {targets:['[data-feature="recursos"]'],title:'Elige la audiencia',body:'Los administradores crean recursos internos por defecto. Publicar para clientes requiere revisión expresa; abrir un enlace de pago no confirma un cobro.'},
  ]},
  {id:'funcion:importaciones',kind:'feature',title:'Importar contactos con revisión',summary:'Relacionar columnas, detectar coincidencias y guardar las filas elegidas.',route:'/importaciones',minRole:'ADMIN',steps:[
    {title:'Tu cartera entra con orden',body:'Importa hasta 500 prospectos o clientes desde Excel o CSV. También puedes revisar tablas preparadas por el chat a partir de imágenes o PDF. Este recorrido explica los pasos; no guarda registros.',illustration:'imports'},
    {targets:['[data-tour="import-source"]'],title:'Elige el archivo',body:'Arrastra un archivo .xlsx, CSV o TSV de hasta 4 MB. Debe incluir encabezados. El archivo se procesa para preparar la tabla; no se publica ni se guarda en la biblioteca.'},
    {targets:['[data-tour="import-mapping"]'],title:'Relaciona las columnas',body:'Elige la hoja y qué columna contiene nombre, correo, teléfono y RFC u origen. Las demás se descartan. Si los teléfonos son mexicanos de diez dígitos, elige explícitamente México (+52).'},
    {targets:['[data-tour="import-counts"]','[data-tour="import-rows"]'],title:'Revisa coincidencias y faltantes',body:'Comparamos con clientes, prospectos y el mismo lote. Las coincidencias no se fusionan. Puedes corregir una fila y confirmar un homónimo; correo, teléfono y RFC coincidentes siguen bloqueados.'},
    {targets:['[data-tour="import-confirm"]'],title:'Guarda solo lo revisado',body:'Selecciona las filas nuevas, compara con la fuente y confirma. Si cambió una coincidencia, el lote se detiene completo. Repetir la confirmación no duplica registros. Descarga el reporte para continuar con los omitidos.'},
  ]},
  {id:'funcion:ficha-mcp',kind:'feature',title:'Formularios del cliente desde el chat',summary:'Preparar una ficha o enlace externo y confirmar antes de compartir.',route:'/conexiones',minRole:'ADMIN',steps:[
    {title:'Tu asistente prepara la ficha',body:'Pide al chat un formulario para un cliente existente o un borrador con nombre y contacto. La propuesta llega aquí y respeta al asesor responsable. El recorrido no crea enlaces ni cambia datos.',illustration:'mcpForms'},
    {targets:['[data-tour="mcp-pending"]'],title:'Confirma el cliente correcto',body:'Abre la propuesta y comprueba el expediente. Un nuevo enlace dura siete días y revoca el anterior. Un borrador no confirma la información ni la autorización del cliente.'},
    {targets:['[data-tour="mcp-pending"]'],title:'Comparte de forma privada',body:'Al confirmar, el CRM muestra una sola vez el enlace y código. Copia el mensaje para compartirlo con el cliente. El MCP solo consulta el estado; no recibe el código ni manda el WhatsApp.'},
    {targets:['[data-tour="mcp-imports"]'],title:'También puedes preparar una lista',body:'El chat puede entregar un lote de prospectos o clientes para revisar aquí. Primero importa los clientes elegidos; después prepara sus formularios por expediente.'},
  ]},
  {id:'funcion:conexiones',kind:'feature',title:'Conectar tu asistente al CRM',summary:'Autorizar tu chat, revisar sus propuestas y retirar el acceso.',route:'/conexiones',steps:[
    {title:'Un chat con acceso a tu espacio AJ',body:'Tu asistente consulta datos administrativos y prepara cambios. Tú eliges los permisos y revisas cada propuesta antes de aplicarla. Este recorrido no autoriza conexiones ni modifica registros.',illustration:'mcp'},
    {targets:['[data-tour="mcp-connect"]'],title:'Copia la dirección y conecta',body:'Añade esta dirección como servidor MCP remoto en tu aplicación. Inicia sesión con la cuenta Google que usas en AJ y empieza con permiso de consulta. La disponibilidad depende de tu aplicación y plan.'},
    {targets:['[data-tour="mcp-pending"]'],title:'Revisa antes de cambiar',body:'Aquí llegan las altas, ediciones, cargas y eliminaciones propuestas. Abre el cambio, comprueba los datos y confirma. Vence a los quince minutos y no sobreescribe cambios recientes del equipo.'},
    {targets:['[data-tour="mcp-connections"]'],title:'Tú controlas el acceso',body:'Retira una conexión cuando lo necesites. Sus tokens dejan de funcionar y se cancelan sus propuestas pendientes. El rol del CRM siempre limita lo que puede hacer.'},
  ]},
  {id:'funcion:tramites',kind:'feature',title:'Trámites y cambios de póliza',summary:'Preparar un cambio, revisar documentos y PDF, registrar firma y seguimiento.',route:'/tramites',context:'procedure',prepare:'procedures',minRole:'ADMIN',steps:[
    {title:'Un trámite, del borrador al endoso',body:'El piloto prepara cambios de domicilio o RFC en GMM individual MetLife. Se conserva la póliza actual. Este recorrido explica los pasos: no crea solicitudes ni envía documentos.',illustration:'procedures'},
    {targets:['[data-tour="procedure-create"]','.procedures-client'],title:'Parte del expediente correcto',body:'Selecciona la póliza y el cambio solicitado. Otras aseguradoras, Vida y Autos necesitan sus propias plantillas; no se reutiliza este formato para ellas.'},
    {targets:['[data-tour="procedure-data"]'],title:'Reutiliza y confirma',body:'Puedes tomar datos de la ficha aprobada. Confirma quién es el contratante y completa sus nombres sin deducir apellidos. Captura por separado el dato nuevo y la fecha solicitada.'},
    {targets:['[data-tour="procedure-attachments"]'],title:'Controla los faltantes',body:'Vincula identificación, Formato 5 y comprobante cuando aplique desde los documentos de la póliza. Los anexos y sus versiones se confirman con la aseguradora.'},
    {targets:['[data-tour="procedure-pdf"]'],title:'Prepara el PDF revisado',body:'Después de revisar los datos podrás preparar el borrador con las dos páginas originales y una portada de pendientes. Las firmas y autorizaciones se dejan para sus titulares.'},
    {targets:['[data-tour="procedure-status"]'],title:'Registra lo que realmente ocurrió',body:'Pendiente de firma, presentado con folio y solicitud firmada, o endoso recibido con evidencia. Descargar un PDF no confirma presentación ni cambia el contrato.'},
  ]},
  { id: 'funcion:ficha-cliente', kind: 'feature', title: 'Ficha del cliente', summary: 'Compartir un formulario, recibir respuestas y revisar los datos del expediente.', route: '/crm/clientes?view=dossiers', context: 'client', prepare: 'intake', minRole: 'ADMIN', steps: [
    { title: 'Tu cliente también puede llenar su ficha', body: 'Comparte un formulario o captura los datos con él. La información llega al expediente para que la revises antes de incorporarla. Este recorrido solo explica: no guarda ni envía nada.', illustration: 'intake' },
    { targets: ['.dossier-grid .dossier-card'], title: 'Elige el expediente de tu cliente', body: 'Abre su carpeta y busca «Ficha del cliente · formulario y WhatsApp». Allí puedes volver a iniciar este recorrido sobre los controles de su ficha.' },
    { targets: ['[data-tour="intake-manual"]'], title: 'Capturar junto con el cliente', body: 'Abre la captura manual si el cliente te da sus datos por llamada, WhatsApp o en persona. Confirma con él la información y su autorización antes de guardar.' },
    { targets: ['[data-tour="intake-link"]'], title: 'Crear su enlace externo', body: 'Genera un enlace y un código de acceso. Duran siete días. El cliente podrá llenar su ficha sin entrar al CRM. Renovar el enlace deja sin acceso al anterior.' },
    { targets: ['.intake-share', '[data-tour="intake-link"]'], title: 'Comparte por WhatsApp', body: 'Al crear el enlace verás «Copiar mensaje para la bandeja» y «Abrir WhatsApp». Comparte el enlace y código solo con el cliente o su representante. Revisa el destinatario antes de enviar.' },
    { targets: ['[data-tour="intake-refresh"]', '.resource-toolbar'], title: 'Recibir las respuestas', body: 'Pulsa «Actualizar respuestas» en la ficha. En Expedientes también verás las fichas pendientes de revisión. Las respuestas aún no cambian los datos principales ni las pólizas.' },
    { title: 'Revisa y elige qué incorporar', body: 'Abre las respuestas completas. Selecciona por separado nombre, correo, teléfono o RFC y confirma la revisión. Los campos vacíos no borran datos; el resto queda en la ficha para futuros trámites.' },
    { targets: ['[data-tour="intake-revoke"]', '.client-intake'], title: 'Tú controlas el acceso', body: 'Al tener un enlace activo verás «Revocar enlace». Esa acción cierra el acceso sin borrar respuestas. No pidas datos médicos, bancarios o firmas en esta ficha administrativa.' },
  ] },
  { id: 'funcion:finanzas', kind: 'feature', title: 'Pagos y renovaciones del expediente', summary: 'Preparar, revisar y guardar calendarios de recibos y nuevas vigencias.', route: '/crm/clientes?view=dossiers', context: 'client', minRole: 'ADMIN', steps: [
    { title: 'Cada vigencia tiene su calendario', body: 'Abre un expediente para revisar las fechas y periodicidad de cada póliza. Los recibos y las renovaciones se preparan antes de guardar. El recorrido no modifica registros.' },
    { targets: ['.dossier-grid .dossier-card'], title: 'Abre el expediente', body: 'Cada póliza tiene sus controles de pagos y renovación. Desde una carpeta puedes revisar los datos reales y continuar allí con el asesor.' },
    { targets: ['.finance-panel'], title: 'Revisa antes de guardar', body: 'El panel de la póliza permite preparar el calendario o una renovación. Comprueba vigencia, moneda, prima y recibos. Una prima importada no demuestra por sí sola que un recibo esté pagado.' },
    { title: 'Conserva la historia de la póliza', body: 'La renovación debe mantener el vínculo con la póliza anterior. Si otro asesor cambió los datos, actualiza y vuelve a revisar la propuesta antes de guardarla.' },
  ] },
  { id: 'modulo:novedades', kind: 'module', title: 'Novedades', summary: 'Funciones publicadas, mejoras y recorridos para aprender a usarlas.', route: '/novedades', steps: [
    { targets: ['.release-spotlight', '.release-learning'], title: 'Descubre y aprende', body: 'Las funciones recientes tienen accesos para aprender sobre tu pantalla. Un recorrido no guarda registros, crea enlaces ni envía mensajes.' },
    { targets: ['.release-filters'], title: 'Encuentra un cambio', body: 'Busca por función o módulo y filtra funciones, mejoras o correcciones. El historial muestra las opciones disponibles para tu rol.' },
    { targets: ['.release-history'], title: 'Qué se publicó y cuándo', body: 'Cada entrega agrupa cambios por fecha. Usa «Abrir» para ir a la función o «Ver recorrido» para repetir su explicación.' },
  ] },
  { id: 'modulo:whatsapp', kind: 'module', title: 'WhatsApp', summary: 'Recibir mensajes, responder y resolver conversaciones desde el CRM.', route: '/whatsapp', steps: [
    { title: 'Conversaciones del equipo', body: 'Esta bandeja recibe mensajes y permite responder manualmente desde la cuenta configurada. Necesita un token vigente y cumplir las condiciones de Meta.' },
    { targets: ['.wa-list'], title: 'Encuentra la conversación', body: 'Busca por nombre o número, abre el contacto y revisa los mensajes recibidos antes de responder.' },
    { targets: ['.wa-composer'], title: 'Revisa y envía', body: 'Escribe tu respuesta o pega el mensaje con el enlace y código de la ficha. Comprueba el destinatario y pulsa Enviar. Si falla, revisa la causa indicada antes de reintentar.' },
    { title: 'Cierra el seguimiento cuando termines', body: 'Puedes marcar una conversación resuelta. Las respuestas automáticas de los agentes son una etapa distinta; esta bandeja mantiene el envío bajo control de una persona.' },
  ] },
  { id: 'componente:navegacion', kind: 'component', title: 'Navegación', summary: 'El menú, sus grupos y cómo ganar espacio.', steps: [
    { targets: ['.workspace-nav', '.mobile-tabbar'], title: 'Lo esencial, a la vista', body: 'La barra lateral reúne los accesos de uso diario. Pulsa los tres puntos de «Más» para abrir seguimiento, herramientas y administración según tu rol. La sección actual queda marcada.' },
    { targets: ['.sidebar-toggle'], title: 'Más espacio', body: 'Contrae el menú para ver solo los íconos; pasa el cursor sobre uno para ver su nombre.' },
    { targets: ['.mobile-tabbar button[aria-haspopup]'], title: 'Más módulos', body: 'En el celular, «Más» abre todos los módulos, el Centro de ayuda y tu cuenta.' },
  ] },
  { id: 'componente:busqueda', kind: 'component', title: 'Búsqueda global', summary: 'Encuentra cualquier registro desde cualquier pantalla.', steps: [
    { targets: ['.search-trigger'], title: 'Encuentra cualquier cosa', body: 'Busca clientes, pólizas, recibos, documentos y carpetas. Atajo: Ctrl + K (⌘ K en Mac). Sin texto te muestra acciones rápidas.' },
  ] },
  { id: 'componente:avisos', kind: 'component', title: 'Avisos', summary: 'Cambios del equipo y recordatorios.', steps: [
    { targets: ['.notification-bell'], title: 'Avisos del equipo', body: 'Lo que cambiaron tus compañeros y tus recordatorios. Se actualiza solo; puedes limpiarlos y elegir cuáles recibir en Preferencias.' },
  ] },
  { id: 'componente:cuenta', kind: 'component', title: 'Tu cuenta', summary: 'Centro de ayuda, preferencias, modo oscuro y cierre de sesión.', steps: [
    { targets: ['.account-trigger', '.mobile-tabbar button[aria-haspopup]'], title: 'Tu cuenta', body: 'Aquí abres el Centro de ayuda y tus Preferencias (tema, notificaciones, asistentes), cambias a modo oscuro y cierras sesión. Reportes llegará pronto.' },
  ] },
  { id: 'modulo:resumen', kind: 'module', title: 'Resumen', summary: 'Los números del mes y el embudo de la Ruta AJ.', route: '/', steps: [
    { targets: ['.metrics'], title: 'Tus indicadores del mes', body: 'Prospectos, pólizas, emisiones y renovaciones, comparados con el mes anterior. Toca una tarjeta para abrir su módulo.' },
    { targets: ['.overview-section-label .segmented'], title: 'Por responsable', body: 'Cambia entre todo el equipo, tus números o los de un compañero.' },
    { targets: ['.funnel-panel'], title: 'Embudo de la Ruta AJ', body: 'Cuántos prospectos hay en cada etapa. Pasa el cursor por una barra para ver su porcentaje, o ábrelo como tabla.' },
    { targets: ['.meter-panel'], title: 'Entrega activa', body: 'Qué parte de las pólizas vigentes ya cumple las cinco señales de una entrega completa.' },
    { targets: ['.stat-list'], title: 'Operación diaria', body: 'Recibos vencidos, siniestros abiertos, referidos y cotizaciones del mes.' },
  ] },
  ...modules.map(entry => moduleTour(entry.slug)),
  { id: 'modulo:expediente', kind: 'module', title: 'Expediente del cliente', summary: 'Pólizas, entrega activa, recibos y documentos de un cliente.', listed: false, steps: [
    { title: 'Expediente del cliente', body: 'Todo lo de este cliente en un solo lugar: sus pólizas, su entrega activa, sus recibos y sus documentos.' },
    { targets: ['.delivery-strip'], title: 'Entrega de cada póliza', body: 'La etapa de entrega y el avance de las cinco señales. «Abrir entrega activa» te lleva a su tarjeta.' },
    { targets: ['.document-panel .table-wrap'], title: 'Recibos y vencimientos', body: 'El calendario de recibos de la póliza con su estado: pendiente, vencido o pagado.' },
    { targets: ['.client-contacts'], title: 'Contactos', body: 'Personas además del cliente a quienes se les puede escribir, como RH de una empresa o un familiar. Solo ellos y el cliente pueden recibir correos de este expediente.' },
    { targets: ['.dossier-emails'], title: 'Correos', body: 'Envía la bienvenida o documentos con sus adjuntos. Revisas el texto y la vista previa antes de enviar, las respuestas te llegan a ti y aquí queda el historial.' },
  ] },
  { id: 'modulo:nuevo-expediente', kind: 'module', title: 'Nuevo expediente', summary: 'El asistente de 4 pasos para abrir un expediente.', route: '/crm/clientes/nuevo', minRole: 'ADMIN', steps: [
    { targets: ['.wizard-steps'], title: 'Cuatro pasos', body: 'Cliente, póliza, pagos y revisión. Nada se guarda hasta el último paso, y todo se guarda junto.' },
    { targets: ['.wizard-actions'], title: 'Avanza o regresa', body: 'Puedes volver a cualquier paso antes de guardar. Los recibos deben sumar exactamente la prima total.' },
  ] },
  { id: 'modulo:avisos-clientes', kind: 'module', title: 'Avisos a clientes', summary: 'Renovaciones, recibos y siniestros que conviene avisar hoy, y los textos de correo del equipo.', route: '/avisos', steps: [
    { title: 'Avisos a clientes', body: 'Aquí aparecen renovaciones, recibos y seguimientos de siniestros según los tiempos del responsable de cada póliza. Ajusta los tuyos en Plantillas. Nada se envía solo.' },
    { targets: ['.notice-kinds'], title: 'Filtra por tipo', body: 'Renovaciones, pagos o siniestros. «A mi cargo» incluye los avisos sin responsable.' },
    { targets: ['.notice-actions', '.notices .empty-state'], title: 'Resuelve cada aviso', body: 'Envía el correo sugerido (lo revisas antes), registra que ya le avisaste por llamada o WhatsApp, o descártalo. Siempre puedes deshacer.' },
    { targets: ['.notices-tabs'], title: 'Plantillas de correo', body: 'Crea tus propias plantillas, inserta datos como chips y ajusta tus tiempos de aviso. Antes de enviar puedes editar y revisar el mensaje de cada cliente.' },
  ] },
  { id: 'modulo:asistentes', kind: 'module', title: 'Asistentes', summary: 'Ocho asistentes expertos que consultan el CRM y proponen acciones que tú confirmas.', route: '/asistentes', minRole: 'SUPERADMIN', steps: [
    { title: 'Asistentes de la Ruta AJ', body: 'Cada asistente es experto en una parte del proceso: primer contacto, cotización, entrega, renovaciones y pagos, siniestros, contenidos, análisis y aprendizaje interno.' },
    { targets: ['.assistant-list'], title: 'Elige al experto', body: 'Cada uno conserva su conversación mientras estés en la pantalla. «Nueva conversación» empieza de cero.' },
    { targets: ['.tpi-composer'], title: 'Pregunta o pide algo', body: 'Consultan la cartera con tus permisos y te muestran los pasos que siguen. «Pensar a fondo» responde con más detalle a un costo un poco mayor; apágalo para respuestas rápidas.' },
    { targets: ['.assistant-chat'], title: 'Tú confirmas', body: 'Lo que cambie algo (una actividad, un prospecto, un aviso) aparece como propuesta con Confirmar o Descartar. Los correos se abren en el redactor para que los revises y envíes.' },
  ] },
  { id: 'modulo:agenda', kind: 'module', title: 'Mi agenda', summary: 'Reuniones y recordatorios en tu Google Calendar.', route: '/agenda', steps: [
    { targets: ['.calendar-connection'], title: 'Tu cuenta de Google', body: 'Conecta la misma cuenta con la que entras al CRM. Cada persona gestiona su propia agenda.' },
    { targets: ['.resource-toolbar .button'], title: 'Nueva reunión', body: 'Elige horario, recordatorio e invitados. Puedes solicitar un enlace de Google Meet y enviar invitaciones al crear.' },
    { targets: ['.calendar-activities'], title: 'De actividad a cita', body: 'Agendar prellena una reunión con una actividad pendiente asignada a ti. La actividad mantiene su estado en el CRM.' },
  ] },
  { id: 'modulo:usuarios', kind: 'module', title: 'Usuarios y accesos', summary: 'Quién entra al sistema y con qué permisos.', route: '/usuarios', minRole: 'SUPERADMIN', steps: [
    { targets: ['.resource-toolbar > .button'], title: 'Dar acceso', body: 'Autoriza una cuenta de Google. Solo entran los correos que estén en esta lista.' },
    { targets: ['.table-wrap'], title: 'Roles', body: 'Usuario consulta, Administrador además captura y edita, Superadmin además borra y administra accesos.' },
  ] },
];
export function tourById(id: string) { return tours.find(tour => tour.id === id) ?? null; }
export function canSeeTour(tour: Tour, role: Role) { return !tour.minRole || rank[role] >= rank[tour.minRole]; }
// The tour that explains the screen at this path, if any.
export function tourForPath(pathname: string): Tour | null {
  if (pathname === '/') return tourById('modulo:resumen');
  if (pathname === '/usuarios') return tourById('modulo:usuarios');
  if (pathname === '/agenda') return tourById('modulo:agenda');
  if (pathname === '/avisos') return tourById('modulo:avisos-clientes');
  if (pathname === '/asistentes') return tourById('modulo:asistentes');
  if (pathname === '/novedades') return tourById('modulo:novedades');
  if (pathname === '/drive') return tourById('funcion:drive');
    if (pathname === '/conexiones') return tourById('funcion:conexiones');
  if (pathname === '/importaciones'||/^\/importaciones\/[^/]+$/.test(pathname)) return tourById('funcion:importaciones');
  if (pathname === '/whatsapp') return tourById('modulo:whatsapp');
  if (pathname === '/tramites'||/^\/tramites\/[^/]+$/.test(pathname)) return tourById('funcion:tramites');
  if (pathname === '/crm/clientes/nuevo') return tourById('modulo:nuevo-expediente');
  if (/^\/crm\/clientes\/[^/]+$/.test(pathname)) return tourById('modulo:expediente');
  const match = /^\/crm\/([a-z]+)$/.exec(pathname);
  return match ? tourById(`modulo:${match[1]}`) : null;
}
