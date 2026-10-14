# Sistema AJ

Base full-stack de CRM de seguros con Next.js App Router, TypeScript, Prisma 7 y PostgreSQL. Interfaz en español con paneles claros, navegación agrupada y plegable, acentos pastel y tipografía Clarity City. El login conserva su diseño cálido original. Prospectos y clientes permiten alta, consulta, búsqueda y edición; Documentos permite carga y descarga privada en R2. El resumen muestra métricas reales de la cartera (embudo de la Ruta AJ, pólizas, entregas, cobranza, siniestros, referidos y cotizaciones), filtrables por responsable. El calendario de agendas está previsto para una etapa posterior.

Para continuar el proyecto, consultar [CONTINUIDAD-SISTEMA-AJ.md](docs/CONTINUIDAD-SISTEMA-AJ.md).

## Inicio en Windows (PowerShell)

Requisitos: Node.js >=22.12 (se recomienda Node 24 LTS), npm y PostgreSQL; Docker Desktop es opcional para la base local.

~~~powershell
cd C:\Users\Tony\Desktop\sistema-aj
Copy-Item .env.example .env
npm ci
npm run db:up
npm run db:migrate -- --name init
npm run db:seed
npm run dev
~~~

Abrir http://localhost:3000. Si usas PostgreSQL existente, omite db:up y ajusta DATABASE_URL. Edita AJ_API_TOKEN en .env con un valor aleatorio; nunca enviarlo al navegador ni usar prefijo NEXT_PUBLIC_. La pantalla de acceso funciona sin credenciales; para entrar al CRM se requiere configurar Google, PostgreSQL y los grants de acceso. Las API admiten una sesión autorizada o un token interno de servidor. Lato se descarga desde Google Fonts en el navegador y tiene alternativa Arial si no hay red.

## Scripts

| Script | Función |
| --- | --- |
| dev / build / start | Desarrollo, compilación y ejecución de producción |
| lint / typecheck / test / check | Calidad y pruebas de firma, enrutamiento y validación |
| db:generate / db:validate | Cliente Prisma y validación del esquema |
| db:migrate / db:deploy | Crear migraciones en desarrollo / aplicar migraciones versionadas |
| db:seed / db:studio | Datos ficticios idempotentes / explorador de datos |
| db:up / db:down | Iniciar PostgreSQL local / detenerlo conservando el volumen |

La primera migración SQL está versionada en prisma/migrations; db:migrate la aplica. En producción usa db:deploy. No usar db push como estrategia de despliegue. Los datos de seed son ficticios y no reemplazan registros existentes.

## Estructura

~~~text
src/app/               Layout, dashboard, pantallas y rutas API
src/modules/           Nueve módulos: schema.ts + service.ts por módulo
src/lib/               Prisma singleton y respuestas/autorización API
src/integrations/      Cliente WhatsApp y verificación de firma
src/agents/            Catálogo, selección determinista y contrato de runtime
prisma/                Esquema relacional, migraciones y seed
tests/                 Pruebas de límites e integración criptográfica
docs/                  Arquitectura y próximos pasos
~~~

## API base

Las rutas CRM y de agentes admiten sesiones de Google autorizadas o Authorization: Bearer <AJ_API_TOKEN> para integración interna desde servidor. Las altas requieren rol ADMIN; la gestión de accesos requiere una sesión SUPERADMIN. Los cambios desde el navegador validan el origen exacto.

| Ruta | Comportamiento |
| --- | --- |
| GET /api/health | Estado de aplicación (no consulta PostgreSQL). Con `?db=1` mide, desde la región de la función, la latencia de la base (solo tiempos, sin datos) |
| GET /api/crm/{modulo}?take=&skip=&q=&status=&archived= | Listado paginado (máximo 100) con búsqueda, filtro de estado y vista de archivados (`archived=1`) |
| POST /api/crm/{modulo} | Crea un registro validado (ADMIN); 201 |
| GET /api/crm/{modulo}/{id} | Ficha con sus relaciones; cualquier rol autorizado |
| PATCH /api/crm/{modulo}/{id} | Ficha completa + expectedUpdatedAt (ADMIN); los opcionales omitidos se limpian. Conflicto de versión: 409 RECORD_CHANGED |
| POST /api/crm/{modulo}/{id}/archive | Archiva o restaura con `{ "archived": true }` o `false` (ADMIN) |
| DELETE /api/crm/{modulo}/{id} | Borrado definitivo (SUPERADMIN) solo sin información vinculada; si no, 409 HAS_RELATIONS |
| GET /api/team | Personas del equipo para asignar responsable |
| PATCH /api/preferences | Preferencias de la persona que inició sesión: vistas, recorridos guiados, tema claro/oscuro, notificaciones (tipos y limpieza) y modelo de los asistentes |
| POST/DELETE /api/products/{id}/image | Sube o quita la imagen de un producto (ADMIN); GET la muestra con un enlace firmado |
| GET /api/policies/delivery-board | Pólizas activas con su etapa de entrega activa |
| GET/PATCH /api/policies/{id}/delivery | Entrega activa de una póliza: fecha, checklist de 5 puntos, posible referido y seguimientos 7/30/90 (PATCH ADMIN con expectedUpdatedAt) |
| GET /api/search?q= | Búsqueda global (mínimo 2 letras): registros de todos los módulos, archivos, carpetas y, para el superadmin, accesos |
| GET /api/notifications?since= | Novedades de otras personas del equipo y recordatorios (recibos vencidos, renovaciones de la semana) |
| GET /api/agents | Catálogo de los ocho asistentes y si la IA está configurada |
| POST /api/assistant/chat | Un turno de un asistente en streaming (JSON por líneas); requiere `ANTHROPIC_API_KEY` |
| POST /api/assistant/actions | Ejecuta una propuesta confirmada (ADMIN): crear actividad, registrar o mover prospecto, resolver aviso, preparar correo |
| GET /api/whatsapp/webhook | Desafío de verificación Meta |
| POST /api/whatsapp/webhook | Firma HMAC + persistencia idempotente del payload |
| GET /api/documents?q=&take=&skip=&folderId=&clientId= | Archivos y carpetas de una carpeta, en la biblioteca del equipo o de un expediente |
| POST /api/documents | Carga multipart a R2 privado (ADMIN); máximo 4 MiB; `folderId` opcional |
| PATCH /api/documents/{id} | Mueve un archivo de carpeta (ADMIN); requiere `expectedUpdatedAt` |
| GET /api/documents/{id}/download | Redirección 303 a un enlace firmado de 60 segundos |
| POST /api/documents/{id}/archive | Archiva o restaura un archivo (ADMIN) |
| DELETE /api/documents/{id} | Borra el archivo de la base y de R2 (SUPERADMIN) |
| POST /api/folders | Crea una carpeta o subcarpeta (ADMIN) |
| GET /api/folders | Carpetas archivadas de la biblioteca del equipo o, con `?clientId=`, de un expediente |
| PATCH /api/folders/{id} | Renombra una carpeta o cambia su color (ADMIN); requiere `expectedUpdatedAt` |
| POST /api/folders/{id}/archive | Archiva o restaura una carpeta con su contenido (ADMIN); body `{ archived }` |
| DELETE /api/folders/{id} | Elimina una carpeta vacía (ADMIN); si tiene contenido, 409 FOLDER_NOT_EMPTY |
| POST /api/dossiers | Abre un expediente: cliente, carpetas base y, opcionalmente, su primera póliza con recibos (ADMIN) |
| POST /api/dossiers/{id}/policies | Añade una póliza con su calendario de recibos a un expediente (ADMIN) |
| GET/POST /api/dossiers/{id}/contacts | Contactos adicionales del cliente (lectura con sesión; alta ADMIN) |
| PATCH/DELETE /api/dossiers/{id}/contacts/{contactId} | Edita o quita un contacto (ADMIN) |
| GET /api/emails?clientId= | Historial de correos enviados a un cliente |
| GET /api/emails/options?clientId= | Destinatarios permitidos, archivos que se pueden adjuntar y última bienvenida (ADMIN) |
| POST /api/emails | Envía documentos o la bienvenida a un cliente y/o sus contactos (ADMIN); `requestId` evita duplicados. Ver docs/correo-resend.md |
| POST /api/emails/webhook | Eventos de entrega de Resend firmados con Svix (`RESEND_WEBHOOK_SECRET`) |
| GET /api/cron/email | Tarea diaria: recordatorios de agenda, avisos a clientes y resumen diario (`CRON_SECRET` o token interno) |
| GET /api/notices?scope=mine\|all | Avisos a clientes pendientes (se actualizan al leer); `resolved=1` lista los resueltos en 14 días |
| POST /api/notices/{id} | Registra que se avisó por otro medio, descarta o reabre un aviso (ADMIN) |
| GET /api/email-templates | Plantillas de correo del equipo (ADMIN) |
| PUT/DELETE /api/email-templates/{kind} | Guarda el texto del equipo o vuelve al sugerido (ADMIN) |

Módulos: prospectos, clientes, polizas, cotizaciones, pagos, renovaciones, siniestros, documentos, actividades. Fechas: ISO 8601 con zona horaria. Importes: texto decimal positivo como "1250.00"; moneda: código de tres letras, MXN por defecto. El schema.ts de cada módulo define los campos aceptados. Las relaciones deben referenciar IDs existentes. Campos desconocidos se rechazan. POST /api/crm/documentos responde 405: los documentos solo se registran mediante la carga verificada de /api/documents.

~~~powershell
$headers = @{ Authorization = "Bearer $env:AJ_API_TOKEN" }
# Cargar AJ_API_TOKEN manualmente en la sesión; PowerShell no lee .env automáticamente.
$body = @{ name = "Prospecto de prueba"; source = "manual" } | ConvertTo-Json
Invoke-RestMethod http://localhost:3000/api/crm/prospectos -Method Post -Headers $headers -ContentType application/json -Body $body
Invoke-RestMethod http://localhost:3000/api/crm/prospectos -Headers $headers
~~~

Errores: 400 datos/JSON inválidos, 404 módulo desconocido, 409 identificador único duplicado, 422 relación inexistente, 503 servicio/configuración no disponible. No se exponen detalles de conexión ni payloads privados en errores.

## WhatsApp Business API

Configurar variables WHATSAPP_* con valores de tu aplicación Meta. Exponer /api/whatsapp/webhook mediante HTTPS, registrar callback y verify token, suscribir eventos de mensajes. GET responde al desafío; POST valida x-hub-signature-256 usando el cuerpo original y APP_SECRET. La respuesta 200 solo llega tras persistir el evento. Los reintentos idénticos reutilizan payloadHash; antes de enviar mensajes o ejecutar acciones, el worker futuro también debe deduplicar por ID de mensaje/evento de Meta (payloads distintos pueden contener el mismo mensaje).

sendTemplate es un adaptador de servidor para plantillas aprobadas sin parámetros; no hay endpoint público de envío. Falta el worker de consumo del inbox, política de reintentos, consentimiento, plantillas parametrizadas, retención de datos y seguimiento de entrega. No se enviaron mensajes al preparar esta base.

## Asistentes IA

Ocho asistentes de la Ruta AJ en `/asistentes` (primer contacto por WhatsApp, captura para cotización, entrega de póliza, renovaciones y pagos, siniestros y orientación médica, contenidos y guiones, análisis de casos y aprendizaje interno). Usan Claude por la API de Anthropic (`ANTHROPIC_API_KEY`), consultan el CRM con los permisos de quien pregunta y solo proponen cambios: cada propuesta se confirma en el chat y los correos se revisan y envían desde el redactor. El Método AJ todavía requiere documentación del negocio: no se inventaron reglas. Ver docs/asistentes.md.

## Alcance y siguientes pasos

Los ocho módulos de datos (prospectos, clientes, pólizas, cotizaciones, recibos, renovaciones, siniestros y actividades) tienen tabla con búsqueda, filtros, vista de archivados, alta y edición en modal, archivado y borrado definitivo para el superadmin. En móvil, las tablas se vuelven tarjetas deslizables y la navegación pasa a una barra inferior. Clientes se presenta además como expedientes: un asistente abre el expediente con su primera póliza y su calendario de recibos. Documentos organiza los archivos privados de R2 en carpetas y sube en segundo plano (ver docs/documentos-r2.md). Cada cambio queda registrado en CrmEvent, que alimenta las notificaciones del equipo (consulta cada 20 s). Pendientes: dashboard real, conversión de prospecto a cliente, permisos por expediente, worker WhatsApp, adaptador de IA, observabilidad y políticas de respaldo.

Referencias: [Next.js](https://nextjs.org/docs/app), [Prisma PostgreSQL](https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/postgresql), [Meta Webhooks](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/create-webhook-endpoint), [eve](https://eve.dev/docs).

## Conexión hospedada y creación de tablas

DATABASE_URL es el nombre recomendado para la conexión pooled. Se acepta DATA_URL como nombre heredado para conservar secretos ya guardados en Vercel. DIRECT_URL permite indicar la conexión directa para migraciones. Para Prisma Postgres, si no se especifica DIRECT_URL, se convierte exclusivamente el host documentado pooled.db.prisma.io a db.prisma.io conservando credenciales, base y opciones TLS; otros proveedores no se transforman.

npm run db:verify-deploy comprueba la conexión, se detiene ante una base con tablas ajenas sin historial Prisma, aplica únicamente migraciones pendientes y verifica las veintidós tablas de aplicación y el historial. No borra tablas ni inserta datos de ejemplo. Requiere una URL PostgreSQL TCP; las URLs de Accelerate no son compatibles con el adaptador pg de esta base. Este comando es explícito y no se añadió al build habitual.

npm run crm:smoke ejecuta una prueba integrada después de compilar, con PostgreSQL configurado. Usa una instancia local temporal de Next y un token interno efímero; comprueba altas, búsqueda, ficha, edición, limpieza de campos opcionales, rechazo de ediciones antiguas y protección anónima. Solo crea y retira dos registros de prueba con nombres únicos. No inicia sesión como un usuario real ni modifica su acceso.

## Inicio de sesión y roles

Better Auth 1.7 integra Google OAuth en /api/auth/callback/google. Registrar en Google Cloud el URI exacto de producción y guardar GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET en Vercel Production. BETTER_AUTH_URL contiene el origen canónico de la app; BETTER_AUTH_SECRET debe ser un secreto aleatorio de al menos 32 caracteres. No se configuraron contraseñas locales: su recuperación corresponde a Google.

AJ_SUPERADMIN_EMAIL define la identidad principal. AJ_ADMIN_EMAILS enumera, separados por coma, los administradores iniciales. Sus direcciones se guardan fuera del repositorio público. La ejecución explícita db:verify-deploy crea los grants iniciales sin reactivar cuentas que luego fueron deshabilitadas. El superadmin puede gestionar usuarios desde /usuarios; los administradores operan el CRM y los usuarios solo consultan. Los cambios de acceso se auditan. La cuenta principal no puede desactivarse ni modificarse desde esa interfaz.

Las rutas CRM y de agentes aceptan sesiones autorizadas además del token interno opcional. Los cambios con cookies exigen Origin igual a BETTER_AUTH_URL. Todas las pantallas del CRM validan sesión del lado servidor. El registro de usuarios y la creación de sesiones rechazan cuentas no autorizadas o no verificadas por Google. Revocar un acceso invalida las sesiones existentes. No se admiten enlaces entre proveedores ni cambios de correo.

El correo sale por Resend desde `avisos@segurosaleyjoel.com` (dominio verificado): documentos y bienvenida a clientes siempre con clic de una persona, avisos al equipo de prospectos y siniestros nuevos, y recordatorios de agenda programados. Detalles, variables (`RESEND_API_KEY`, `RESEND_FROM_ADDRESS`, `RESEND_WEBHOOK_SECRET`, `AJ_PRIVACY_URL`) y límites en docs/correo-resend.md. WhatsApp y la ejecución de IA siguen pendientes. Las métricas de tiempos de respuesta y de casos convertidos en contenido se medirán cuando existan WhatsApp y el registro de contenido.

## Agenda y Google Calendar

Cada usuario puede abrir **Mi agenda** y conectar su propia cuenta Google para crear reuniones, recordatorios e invitaciones, con Google Meet cuando la cuenta lo admite. Las actividades pendientes asignadas se pueden agendar sin cambiar su estado. Consulta [configuraci?n y funcionamiento](docs/google-calendar.md). Aplicar la migraci?n `20261013120000_google_calendar` antes de desplegar.
