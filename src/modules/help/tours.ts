import { modules, type ModuleSlug } from '../catalog';
import { resources, isResourceSlug } from '../resources/config';
// Guided tours for the Help Center. Pure (unit tested in tests/tours.test.ts): the browser resolves each
// step's first visible target and skips steps whose element is not on screen (role, view or empty list).
export type TourStep = { targets?: string[]; title: string; body: string };
export type Tour = { id: string; kind: 'component' | 'module'; title: string; summary: string; route?: string; minRole?: 'ADMIN' | 'SUPERADMIN'; listed?: boolean; steps: TourStep[] };
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
  { id: 'componente:navegacion', kind: 'component', title: 'Navegación', summary: 'El menú, sus grupos y cómo ganar espacio.', steps: [
    { targets: ['.workspace-nav', '.mobile-tabbar'], title: 'Tus módulos', body: 'Los módulos se agrupan en Relaciones, Operación y Organización. El que tienes abierto se marca en verde.' },
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
    { title: 'Avisos a clientes', body: 'Cada mañana aparecen las renovaciones a 30, 20 y 10 días, los recibos a 20 y 10 días y el día que vencen, y los siniestros abiertos cada semana. Nada se envía solo.' },
    { targets: ['.notice-kinds'], title: 'Filtra por tipo', body: 'Renovaciones, pagos o siniestros. «A mi cargo» incluye los avisos sin responsable.' },
    { targets: ['.notice-actions', '.notices .empty-state'], title: 'Resuelve cada aviso', body: 'Envía el correo sugerido (lo revisas antes), registra que ya le avisaste por llamada o WhatsApp, o descártalo. Siempre puedes deshacer.' },
    { targets: ['.notices-tabs'], title: 'Plantillas de correo', body: 'Ajusta el texto de la bienvenida, documentos, renovación, pago y siniestro con datos como {cliente} o {vence}. Quien envía aún puede editarlo.' },
  ] },
  { id: 'modulo:asistentes', kind: 'module', title: 'Asistentes', summary: 'Ocho asistentes expertos que consultan el CRM y proponen acciones que tú confirmas.', route: '/asistentes', steps: [
    { title: 'Asistentes de la Ruta AJ', body: 'Cada asistente es experto en una parte del proceso: primer contacto, cotización, entrega, renovaciones y pagos, siniestros, contenidos, análisis y aprendizaje interno.' },
    { targets: ['.assistant-list'], title: 'Elige al experto', body: 'Cada uno conserva su conversación mientras estés en la pantalla. «Nueva conversación» empieza de cero.' },
    { targets: ['.tpi-composer'], title: 'Pregunta o pide algo', body: 'Consultan la cartera con tus permisos y te muestran los pasos que siguen. «Pensar a fondo» responde con más detalle; apágalo para respuestas rápidas.' },
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
  if (pathname === '/crm/clientes/nuevo') return tourById('modulo:nuevo-expediente');
  if (/^\/crm\/clientes\/[^/]+$/.test(pathname)) return tourById('modulo:expediente');
  const match = /^\/crm\/([a-z]+)$/.exec(pathname);
  return match ? tourById(`modulo:${match[1]}`) : null;
}
