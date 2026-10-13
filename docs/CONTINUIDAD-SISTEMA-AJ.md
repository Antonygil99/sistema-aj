# Sistema AJ — continuidad del proyecto

Actualizado: 13 de octubre de 2026. Documento para continuar el trabajo con Claude o cualquier desarrollador. No contiene credenciales ni correos privados de las cuentas autorizadas.

## 1. Objetivo y alcance acordado

CRM propio para la operación de seguros de AJ. El flujo deseado es prospecto → seguimiento → cotización → cliente → póliza → pagos, renovaciones y siniestros, con documentos y actividades vinculados. WhatsApp será un canal de entrada y atención, con captura estructurada, agentes especializados y derivación a una persona cuando corresponda.

La conversación de referencia es **Cotización CRM con IA**. Su texto accesible confirma CRM propio, WhatsApp, captura de datos, handoff humano e IA especializada. El contenido completo del PDF de cotización no estaba disponible para comparar cada partida; no asumir que esa comparación ya ocurrió. Solicitar el PDF antes de cerrar una matriz contractual de alcance.

## 2. Ubicación y servicios

- Carpeta de trabajo: `C:\Users\Tony\Desktop\sistema-aj`.
- Repositorio: https://github.com/Antonygil99/sistema-aj (público), rama `main`.
- Aplicación de producción: https://crm.segurosaleyjoel.com.
- Hosting: Vercel, proyecto `sistema-aj`, Node 24. Los pushes a `main` disparan despliegue.
- Base: Prisma Postgres, consultada con Prisma ORM + adaptador PostgreSQL TCP.
- Identidad: Google OAuth y Better Auth.
- Archivos: Cloudflare R2 privado, SDK compatible con S3.
- Google Drive: integración futura opcional por usuario.
- Resend: pendiente para correos transaccionales.

El dominio propio ya aparece conectado al proyecto de Vercel. Cloudflare R2 es independiente del DNS del dominio. No cambiar DNS, configuración de Google ni secretos que funcionan sin una razón comprobada.

## 3. Arquitectura de código

Stack: Next.js 16 App Router, React 19, TypeScript, Prisma 7, PostgreSQL, Zod 4 y Better Auth 1.7.7. El CRM adopta las referencias visuales de Tony: barra lateral verde grisácea, navegación agrupada y plegable, paneles blancos redondeados, acentos pastel, botones oscuros y tipografía Clarity City. El login conserva intacto el diseño anterior de Claude, con fotografía y paleta cálida.

El tema del CRM está aislado bajo `.workspace` en `src/app/(workspace)/workspace.css`; `WorkspaceShell` controla navegación, sección activa y cuenta. No modificar los estilos globales ni el login para extender este tema. En móvil la navegación se desplaza horizontalmente y cerrar sesión sigue disponible en la cabecera. La agenda es una etapa futura solicitada por Tony: por ahora solo hay una tarjeta identificada como “Más adelante”, sin calendario operativo ni datos de citas. El resumen muestra métricas reales: cuatro indicadores con variación contra el mes anterior, el embudo de la Ruta AJ (barras con vista de tabla), el avance de entrega activa y una lista de operación (recibos vencidos, siniestros, referidos y cotizaciones). Se filtra por responsable con `?owner=me|all|<correo>`. Tiempos de respuesta y casos convertidos en contenido quedan pendientes hasta conectar WhatsApp y el registro de contenido. La revisión visual usa componentes reales con datos ficticios locales, sin eludir la autenticación del CRM.

```text
src/app/
  (workspace)/layout.tsx          Sesión obligatoria, navegación y rol
  (workspace)/page.tsx            Resumen con métricas reales (dashboardMetrics + DashboardOverview)
  (workspace)/crm/[module]/       Pantallas de los nueve módulos
  (workspace)/usuarios/           Gestión reservada al superadmin
  login/                         Inicio de sesión con Google
  api/auth/[...all]/              Better Auth y callback Google
  api/crm/[module]/               Listar y crear registros
  api/crm/[module]/[id]/          Ficha y edición de prospectos/clientes
  api/documents/                 Lista, búsqueda y carga de archivos
  api/documents/[id]/download/    Descarga privada temporal
  api/users/                     Gestión auditada de accesos
  api/whatsapp/webhook/           Firma, verificación y persistencia de inbox
  api/agents/                    Catálogo y selección por tema; sin ejecutar IA
src/components/                  Formularios, tablas, página de documentos, navegación
src/lib/                         Auth, sesión, permisos, API y singleton Prisma
src/modules/<modulo>/            Validación Zod y servicio de persistencia
src/modules/shared/              Validaciones comunes, búsqueda y edición de contactos
src/integrations/r2/             SDK R2 y configuración de servidor
src/integrations/whatsapp/       Firma y adaptador de plantillas Meta
src/agents/                     Catálogo, selección y contrato AgentRuntime
prisma/                          Esquema, migraciones y seed local
scripts/                         Migración verificada y prueba integrada CRM
tests/                           Pruebas de negocio, archivos, accesos y migraciones
docs/                            Arquitectura y continuidad
```

Cada módulo tiene `schema.ts` y `service.ts`. El navegador no debe importar Prisma, credenciales ni clientes de servidor. El código que maneja secretos se une mediante wrappers `server-only`; la política pura y la orquestación pueden probarse sin Next.js.

## 4. Modelo de datos

Nueve modelos CRM: `Prospect`, `Client`, `Policy`, `Quote`, `Payment`, `Renewal`, `Claim`, `Document` y `Activity`. Más `DocumentFolder`, `CrmEvent`, `WebhookEvent`, `AgentRun`, `AccessGrant`, `AuthUser`, `AuthSession`, `AuthAccount`, `AuthVerification`, `AuthRateLimit` y `AccessAudit`: **20 tablas de aplicación**, aparte del historial Prisma.

Importes: `Decimal(12,2)`; fechas con zona horaria; relaciones con restricciones de borrado para proteger expedientes. No usar borrados de cartera ni `prisma db push` para desplegar. La migración inicial y la migración Google ya se aplicaron en producción. La migración `20261013010000_dossiers_folders` añade `DocumentFolder`, `Document.folderId` y `Policy.paymentFrequency`; debe aplicarse con `npm run db:verify-deploy` **antes** de publicar el código que la usa, porque el build de Vercel no ejecuta migraciones. Se verificó localmente sobre PostgreSQL (PGlite) que las tres migraciones se aplican en orden y que el índice de nombres de carpeta funciona. La migración `20261013020000_archive_events` añade `archivedAt` a los nueve modelos CRM y la tabla `CrmEvent`; también debe aplicarse antes de publicar.

## 5. Identidad, roles y seguridad existentes

- SUPERADMIN: cuenta principal, administración de accesos y operación CRM.
- ADMIN: dos cuentas iniciales y otros accesos autorizados; altas y modificaciones CRM.
- USER: consulta y descarga.
- Los correos reales viven en variables privadas y filas `AccessGrant`; no ponerlos en código público.
- Solo cuentas autorizadas y verificadas por Google pueden crear usuarios/sesiones. El superadmin se reconoce únicamente mediante la identidad principal configurada.
- La gestión de usuarios está auditada; desactivar un acceso revoca sus sesiones. La cuenta principal está protegida de modificación desde la interfaz.
- Cambios con cookies: validar el `Origin` exacto contra `BETTER_AUTH_URL`.
- El token interno opcional `AJ_API_TOKEN` permite integración de servidor hasta ADMIN, nunca SUPERADMIN. Nunca enviarlo al navegador.
- Hoy los registros son compartidos por el equipo autorizado. No existe aislamiento por organización, propietario o cartera; los permisos por expediente siguen pendientes.
- Sin contraseñas locales: recuperación de cuenta mediante Google, no mediante un flujo de contraseña propio.

El usuario confirmó una entrada real con Google y la visualización correcta de roles. La autorización de usuarios de prueba en Google Cloud continúa siendo relevante mientras el cliente OAuth esté en modo de pruebas.

## 6. Documentos R2: funcionamiento validado

El usuario confirmó en producción que pudo subir y descargar un archivo de prueba después de corregir el formato del endpoint.

- Bucket privado, token limitado a lectura/escritura de objetos de ese bucket.
- Carga desde el navegador hacia Next.js, y de Next.js a R2. No necesita CORS del bucket para este flujo.
- Límite actual: 4 MiB por archivo, para respetar el cuerpo permitido por Vercel.
- Tipos: PDF, JPEG, PNG, WebP, MP3, OGG, WAV y MP4. Extensión, MIME y firma inicial del contenido se validan; esto no sustituye antivirus.
- Asociación opcional a un único cliente, póliza o siniestro; sin relación es archivo general del equipo.
- Claves únicas `aj/documents/<uuid>.<ext>`; no se sobrescriben archivos por nombre.
- Guardar metadatos en PostgreSQL después de subir. Si falla la base, borrar únicamente el objeto nuevo. Si falla la limpieza, queda un marcador sin secretos para conciliación futura.
- Descarga: validar sesión/rol y existencia, luego redirigir a un enlace firmado de 60 segundos con descarga forzada. Una URL firmada permite acceso a quien la tenga hasta caducar; no equivale a un archivo público permanente.
- La ruta genérica de creación de documentos está cerrada. Listados omitieron `storageKey`; solo el servidor maneja claves de almacenamiento.
- Configuración: recorta espacios y admite el endpoint de cuenta o ese mismo endpoint con `/nombre-del-bucket`; rechaza hosts ajenos, otros paths, consultas y credenciales en la URL.
- Si la configuración falla, administradores reciben una causa sanitizada, sin valores secretos.

Pendientes de archivos: carga directa con URL PUT firmada para archivos grandes y CORS específico, confirmación de contenido en servidor, antivirus, auditoría, edición/eliminación, conciliación de huérfanos, búsqueda de expedientes más allá de los 100 recientes, respaldo y retención. Ver `docs/documentos-r2.md`.

## 7. Prospectos y clientes: nueva entrega

Implementación publicada en producción con pantallas de alta, listado paginado, búsqueda y edición. El despliegue terminó READY y el dominio del CRM apunta a esa versión. Pasaron 22 pruebas locales y la compilación. Además, un despliegue ejecutó `npm run check && npm run crm:smoke`: se verificaron API y PostgreSQL reales para ambos módulos, incluyendo rechazo de cambios anónimos y ediciones antiguas. Los dos registros temporales se retiraron. Falta la prueba manual del usuario sobre estas nuevas pantallas; la prueba manual de R2 sí está confirmada.

Prospectos: nombre, correo y teléfono opcionales, origen, notas y estado (nuevo, contactado, calificado, ganado, perdido). Clientes: nombre, correo, teléfono y RFC opcional. Usuarios consultan fichas; administradores crean y editan. Búsqueda por nombre/correo/teléfono y filtro de estado para prospectos.

La edición envía `expectedUpdatedAt` y solo se aplica si coincide con la versión en la base. Un conflicto devuelve 409 `RECORD_CHANGED`, sin sobrescribir el trabajo ajeno. La interfaz conserva el borrador y pide revisar la versión actual. Para limpiar un campo opcional, el formulario envía la ficha completa sin ese valor; el servicio lo convierte en `null`. No hay eliminación ni conversión automática de prospecto a cliente: marcarlo ganado no crea un cliente.

### Expedientes de clientes y carpetas

`/crm/clientes` muestra los clientes como expedientes (tarjetas con estado de cobertura y próximo recibo); la lista de contactos sigue en `/crm/clientes?view=list`. Un asistente en `/crm/clientes/nuevo` (ADMIN) abre el expediente en cuatro pasos: cliente, póliza, calendario de recibos y revisión. Todo se guarda en una sola transacción (`POST /api/dossiers`): cliente, carpetas base (Identificación, Pólizas, Pagos, Siniestros) y, si se eligió, la póliza con sus recibos. La ficha `/crm/clientes/{id}` muestra vigencias, recibos (pendiente, vencido o pagado), siniestros y actividades, y permite añadir otra póliza (`POST /api/dossiers/{id}/policies`).

Reglas implementadas en `src/modules/clientes/dossier-policy.ts` (probadas en `tests/dossiers.test.ts`):
- La prima total es la suma exacta de los recibos, en centavos. El calendario propuesto reparte la prima y el último recibo absorbe el residuo; los vencimientos mensuales respetan el fin de mes. Los recibos van ordenados dentro de la vigencia; el pago único admite un solo recibo.
- "Activo" significa cobertura vigente hoy. Los recibos vencidos se muestran aparte y no cancelan la póliza automáticamente. Sin pólizas, el expediente queda "Por completar".
- Ningún recibo se marca como pagado de forma automática. Registrar pagos sigue pendiente.

Documentos se organiza en carpetas del equipo o de cada expediente; detalles en `docs/documentos-r2.md`. Falta la prueba manual del usuario sobre expedientes y carpetas.

### Experiencia de uso: tablas, modales, avisos y móvil

- **Tablas de los ocho módulos de datos** con un solo componente (`ResourceManager`) y una configuración por módulo (`src/modules/resources/config.ts`). Incluyen búsqueda (también por relaciones, p. ej. número de póliza o nombre del cliente), filtro de estado, vista Activos/Archivados, alta y edición en modal con selectores de cliente, póliza, prospecto o siniestro, paginación y actualización automática cuando alguien del equipo cambia algo.
- **Archivar o eliminar:** archivar (ADMIN) oculta sin perder historial y se puede deshacer desde el toast o restaurar desde «Archivados». Eliminar definitivamente es solo para el superadmin y solo sin información vinculada (409 `HAS_RELATIONS`). Documentos: archivar (ADMIN) y borrar de la base y de R2 (superadmin). Carpetas: eliminar solo vacías.
- **Modales** con transición compartida (crecen desde el botón que los abrió) usando GSAP, foco atrapado, Esc y regreso del foco. En móvil son hojas inferiores que se cierran deslizando hacia abajo. Confirmaciones con `useConfirm`.
- **Toasts** de éxito, error, aviso, información y seguridad (sesión vencida, permiso denegado, origen bloqueado), conexión perdida o recuperada. Se pausan al pasar el cursor y se descartan deslizándolos.
- **Notificaciones** por sondeo ligero (`/api/notifications`, cada 20 s con la pestaña visible): campana con contador, actividad reciente del equipo (`CrmEvent`, que sirve también como auditoría CRM) y recordatorios de recibos vencidos y renovaciones de la semana.
- **Buscador global** (lupa a la derecha de la campana, o ⌘K / Ctrl+K): busca en clientes, pólizas, prospectos, cotizaciones, recibos, renovaciones, siniestros, actividades, archivos, carpetas y, para el superadmin, usuarios. Cada resultado lleva directo a su ficha, carpeta o descarga. Vacío muestra acciones rápidas y búsquedas recientes. Se rehízo con el diseño del componente ActionSearchBar de referencia, pero sin Tailwind, shadcn ni framer-motion, para no alterar los estilos existentes.
- **Subidas en segundo plano** estilo Drive: cola global con progreso por archivo, 2 cargas simultáneas, cancelar y reintentar, aviso al terminar y advertencia si se cierra la pestaña con cargas pendientes. Siguen corriendo al cambiar de pantalla dentro del CRM.
- **Estados vacíos** con ilustraciones de unDraw (licencia unDraw: uso comercial sin atribución; no redistribuirlas como colección) recoloreadas a `#6f9a82` en `public/illustrations/`.
- **Móvil (≤760 px):** barra inferior con Resumen, Clientes, Prospectos, Archivos y «Más» (hoja con todos los módulos y la cuenta). Las tablas se vuelven tarjetas: deslizar a la izquierda muestra Archivar y Eliminar.
- Verificado con capturas de una vista previa temporal con datos ficticios (escritorio y 390 px) y con pruebas unitarias; la prueba manual con datos reales queda pendiente.

### Entrega activa, productos y responsables (Ruta de implementación AJ v1)

Basado en los documentos del cliente «Método aplicado a AJ Consultoría» y «Sistema AJ inspirado en IA para agentes de seguros - Ruta de implementación v1.0».

- **Catálogo de productos** (`/crm/productos`): nombre, aseguradora, ramo (gastos médicos, autos, vida, hogar, otro), descripción, datos básicos del servicio, responsable por defecto e imagen privada en R2. Se empieza con Médica Vital, que el equipo captura con su imagen.
- **Responsables:** Ale atiende seguros médicos y Joel seguros vehiculares. Las pólizas creadas desde un producto heredan su responsable; los seguimientos se asignan a esa persona y la campana muestra «seguimientos para hoy».
- **Entrega activa** (`/crm/entregas`): tablero con las etapas del sprint del cliente (emitida → entregada → explicada → seguimiento 7 días → seguimiento 30 días → posible referido). Cada póliza tiene fecha de entrega, el checklist de «póliza completada» (recibió, entendió, sabe a quién acudir, sabe cuándo avisar, tiene claro el primer paso), seguimientos automáticos a 7, 30 y 90 días y la marca de posible referido. El modal muestra el mensaje guía del documento del cliente para cada etapa.
- La ficha del cliente indica la etapa de entrega de cada póliza y enlaza a su entrega activa; el asistente de expediente permite elegir el producto del catálogo.
- **Decisiones del cliente para siguientes etapas:** «diagnosticado» significa que respondió las 5 preguntas de diagnóstico; de antecedentes médicos solo se registra si existen, nunca el detalle, y solo los ven Ale y Joel (los únicos usuarios).

### Flujo de 7 etapas: de prospecto a cliente (punto 2)

- **Etapas de prospecto** (Ruta AJ 1–4): Curioso → Diagnosticado → Comparativo guiado → Emisión, más Perdido. La vista principal de Prospectos es un **embudo** con una columna por etapa, avance de diagnóstico y botón «Pasar a …»; la lista sigue disponible. Cada etapa muestra en el formulario su mensaje guía del documento del cliente.
- **Diagnóstico de 5 preguntas** dentro del prospecto: qué le preocupa proteger, quién depende de él, qué hospital o médico usaría, IMSS/póliza actual y antecedentes médicos, y qué le dolería más. Al responder las 5 pasa solo a «Diagnosticado» (definición del cliente). De antecedentes médicos solo se registra Sí/No/No lo sabe; nunca el detalle, y no se envía a cuentas de solo consulta.
- **Referido por**: el cliente que recomendó al prospecto; la ficha del cliente muestra cuántos referidos ha traído y de qué prospecto viene.
- **Conversión sin recaptura**: «Convertir en cliente» abre el asistente de expediente con sus datos; al guardar se crea el cliente (con su póliza, que entra sola al tablero de Entregas) y el prospecto queda en «Cliente» enlazado a él.
- Etapas 5–7 (entrega activa, seguimiento de uso y recomendador) viven en el tablero de Entregas.

## 8. Variables de entorno y ejecución

Variables del servidor (nombres, sin valores):

| Área | Variables |
| --- | --- |
| Base | `DATABASE_URL` o legado `DATA_URL`; `DIRECT_URL` opcional para migraciones |
| Google/auth | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET` |
| Accesos | `AJ_SUPERADMIN_EMAIL`, `AJ_ADMIN_EMAILS`, `AJ_API_TOKEN` opcional interno |
| R2 | `R2_BUCKET_NAME`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` |
| Meta | `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_API_VERSION` |
| IA futura | `AI_GATEWAY_API_KEY`, `AJ_AGENT_MODEL` (reservadas; no ejecutan IA actualmente) |

Google, la base y R2 están guardados en Vercel Production; una variable sensible no se puede recuperar con el acceso actual. Para desarrollo local se necesitan valores privados en `.env`, o servicios locales. No publicar secretos ni usar `NEXT_PUBLIC_` para ellos.

```powershell
cd C:\Users\Tony\Desktop\sistema-aj
npm ci
# Crear .env desde .env.example solo si aún no existe; completar valores privados.
npm run db:generate
npm run dev
npm run check
```

`npm run check`: esquema + lint + tipos + pruebas + compilación. `npm run db:verify-deploy`: comando explícito de migraciones seguras y verificación de tablas/grants; no está en el build habitual. `npm run crm:smoke`: prueba integrada contra la base configurada después de compilar; crea dos registros temporales con nombres únicos, comprueba API/persistencia/búsqueda/edición/conflicto y retira únicamente esos registros. No ejecutarlo sin una base configurada ni afirmar que pasó si solo se ejecutaron pruebas puras.

## 9. Estado de los demás módulos y servicios

| Elemento | Estado real |
| --- | --- |
| Pólizas, cotizaciones, recibos, renovaciones, siniestros, actividades | Tablas con alta, edición, búsqueda, archivo y borrado. Faltan reglas de negocio documentadas (p. ej. marcar recibos vencidos automáticamente, generar renovaciones) |
| Ayuda y preferencias | Centro de ayuda en el menú de cuenta con recorridos guiados por módulo y componente (automáticos opcionales). Preferencias por persona: tema claro, oscuro, según el dispositivo o «Gradiente» (degradado granulado con color base #FC66FF y barra de solo íconos con tooltips; interruptor rápido de modo oscuro en el menú de cuenta), tipos de notificación, modelo de los asistentes (se guarda; la IA aún no está activa) y vistas recordadas en Clientes, Prospectos y Documentos. Las notificaciones se abren bajo la campana y se pueden limpiar. Reportes aparece como «Próximamente» |
| Dashboard | Métricas reales con filtro por responsable; faltan tiempos de respuesta y casos convertidos en contenido |
| WhatsApp | Verificación, HMAC e inbox idempotente por payload. Falta worker, deduplicación por ID Meta, consentimiento, plantillas parametrizadas y pruebas reales |
| IA | Cinco agentes definidos y selección determinista por tema. Sin proveedor/modelo/runtime ejecutándose |
| Método AJ | Falta documentación de fases, guiones, criterios, escalamiento y decisiones aprobadas |
| Google Drive | Pendiente; autorización adicional a login, acceso limitado a archivos seleccionados/creados para el CRM |
| Resend | Pendiente; verificar remitente y preparar bienvenida/notificaciones sin inventar recuperación de contraseña local |
| Dominio | Conectado a Vercel y disponible por HTTPS |

Agentes previstos: coordinador/Método AJ, ventas, siniestros, renovaciones y administrativo. El coordinador reúne contexto y deriva. Agentes proponen borradores y herramientas con permisos limitados; aprobación humana para comunicaciones, emisión, cambios sensibles y movimientos financieros. No darles acceso directo a Prisma o shell. Entradas WhatsApp y documentos son datos no confiables. `eve` está previsto en el contrato actual, no instalado; revisar arquitectura y documentación vigente antes de elegir o activar el runtime.

## 10. Orden recomendado de continuidad

1. Verificar/publicar prospectos y clientes, probar captura y edición con un administrador y lectura con USER.
2. Sustituir métricas ficticias del dashboard por consultas reales con definiciones claras.
3. Implementar cotizaciones, pólizas y conversión de prospectos mediante transacciones, sin duplicar cartera.
4. Completar pagos, renovaciones, siniestros y actividades con reglas de negocio documentadas.
5. Añadir permisos por expediente, respaldo, retención y controles de abuso. La auditoría CRM básica ya existe en `CrmEvent`; falta una pantalla para consultarla.
6. Ampliar archivos y conectar Drive opcionalmente por usuario; mantener R2 como repositorio del equipo.
7. Integrar Resend y luego el primer flujo controlado WhatsApp → captura → derivación humana.
8. Conectar agentes y Método AJ con evidencia del negocio, trazabilidad y herramientas acotadas.

Antes de editar, revisar el estado de Git y los cambios de Claude u otro colaborador. Preservar archivos existentes; no reinicializar el repositorio, resetear bases, reemplazar configuración de producción ni sembrar demos en la cartera real. Reportar por separado pruebas locales, integración con servicios y validación manual del usuario.

Iconografía del CRM: Iconsax, variante Linear, mediante iconsax-reactjs. Mantener esta familia al añadir controles y módulos. El icono oficial de Google del login permanece sin cambios.

## KPIs por módulo y notas de voz del cliente

Los once módulos tienen cuatro KPIs reales, con definición visible, ámbito y actualización tras cambios. En Pólizas y Renovaciones se añadió radar a 60 días; en Pagos, radar de recibos por confirmar en el mes. La falta de calendarios conciliados se muestra como pendiente de datos, sin afirmar que la cobranza está al día. Los audios confirman el modelo de una póliza con varios recibos y priorizan avisos de renovación 30/20/10 días y pagos 20/10/0. Calendario y envío automático siguen pendientes. Ver docs/kpis-y-proceso.md para las fórmulas, el proceso y los límites. Audios y transcripciones completas permanecen fuera del repositorio público.
