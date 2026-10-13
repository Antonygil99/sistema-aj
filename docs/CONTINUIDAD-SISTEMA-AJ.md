# Sistema AJ — continuidad del proyecto

Actualizado: 12 de octubre de 2026. Documento para continuar el trabajo con Claude o cualquier desarrollador. No contiene credenciales ni correos privados de las cuentas autorizadas.

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

El tema del CRM está aislado bajo `.workspace` en `src/app/(workspace)/workspace.css`; `WorkspaceShell` controla navegación, sección activa y cuenta. No modificar los estilos globales ni el login para extender este tema. En móvil la navegación se desplaza horizontalmente y cerrar sesión sigue disponible en la cabecera. La agenda es una etapa futura solicitada por Tony: por ahora solo hay una tarjeta identificada como “Más adelante”, sin calendario operativo ni datos de citas. El dashboard conserva indicadores explícitamente ilustrativos; conectar cifras reales sigue pendiente. La revisión visual usa componentes reales con datos ficticios locales, sin eludir la autenticación del CRM.

```text
src/app/
  (workspace)/layout.tsx          Sesión obligatoria, navegación y rol
  (workspace)/page.tsx            Dashboard; indicadores todavía ilustrativos
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

Nueve modelos CRM: `Prospect`, `Client`, `Policy`, `Quote`, `Payment`, `Renewal`, `Claim`, `Document` y `Activity`. Más `WebhookEvent`, `AgentRun`, `AccessGrant`, `AuthUser`, `AuthSession`, `AuthAccount`, `AuthVerification`, `AuthRateLimit` y `AccessAudit`: **18 tablas de aplicación**, aparte del historial Prisma.

Importes: `Decimal(12,2)`; fechas con zona horaria; relaciones con restricciones de borrado para proteger expedientes. No usar borrados de cartera ni `prisma db push` para desplegar. La migración inicial y la migración Google ya se aplicaron en producción. Las pantallas de contactos aprovechan el esquema existente y no necesitan nuevas tablas.

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
| Pólizas, cotizaciones, pagos, renovaciones, siniestros, actividades | Modelos y API de alta/listado. Pantallas operativas pendientes |
| Dashboard | Métricas ilustrativas; conectar consultas reales de cartera después de contactos |
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
5. Añadir permisos por expediente, auditoría CRM, respaldo, retención y controles de abuso.
6. Ampliar archivos y conectar Drive opcionalmente por usuario; mantener R2 como repositorio del equipo.
7. Integrar Resend y luego el primer flujo controlado WhatsApp → captura → derivación humana.
8. Conectar agentes y Método AJ con evidencia del negocio, trazabilidad y herramientas acotadas.

Antes de editar, revisar el estado de Git y los cambios de Claude u otro colaborador. Preservar archivos existentes; no reinicializar el repositorio, resetear bases, reemplazar configuración de producción ni sembrar demos en la cartera real. Reportar por separado pruebas locales, integración con servicios y validación manual del usuario.
