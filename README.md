# Sistema AJ

Base full-stack de CRM de seguros con Next.js App Router, TypeScript, Prisma 7 y PostgreSQL. Interfaz en español, estilo oscuro con acento verde y fuente Lato. El dashboard presenta datos ilustrativos; no consulta ni representa tu cartera real.

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

Abrir http://localhost:3000. Si usas PostgreSQL existente, omite db:up y ajusta DATABASE_URL. Edita AJ_API_TOKEN en .env con un valor aleatorio; nunca enviarlo al navegador ni usar prefijo NEXT_PUBLIC_. La interfaz demo funciona sin base de datos; las API CRM requieren PostgreSQL, migración y token. Lato se descarga desde Google Fonts en el navegador y tiene alternativa Arial si no hay red.

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

Todas las rutas CRM y de agentes requieren Authorization: Bearer <AJ_API_TOKEN>. Token ausente en servidor: 503; token inválido: 401. Este mecanismo permite uso interno desde servidor; implementar sesiones y permisos por usuario antes de conectar una interfaz real.

| Ruta | Comportamiento |
| --- | --- |
| GET /api/health | Estado de aplicación; no comprueba PostgreSQL |
| GET /api/crm/{modulo}?take=20&skip=0 | Listado paginado (máximo 100), total y registros |
| POST /api/crm/{modulo} | Crea un registro validado; 201 |
| GET /api/agents | Catálogo de cinco agentes |
| POST /api/agents/route | Selecciona un agente por tema; no ejecuta IA |
| GET /api/whatsapp/webhook | Desafío de verificación Meta |
| POST /api/whatsapp/webhook | Firma HMAC + persistencia idempotente del payload |

Módulos: prospectos, clientes, polizas, cotizaciones, pagos, renovaciones, siniestros, documentos, actividades. Fechas: ISO 8601 con zona horaria. Importes: texto decimal positivo como "1250.00"; moneda: código de tres letras, MXN por defecto. El schema.ts de cada módulo define los campos aceptados. Las relaciones deben referenciar IDs existentes. Campos desconocidos se rechazan.

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

## Agentes IA

Coordinador/Método AJ, ventas, siniestros, renovaciones y administrativo tienen responsabilidades y permisos previstos en src/agents/catalog.ts. La selección usa un tema explícito, no una clasificación LLM. AgentRuntime es un contrato para conectar un runtime eve en una etapa posterior. No se instaló ni ejecutó un proveedor de IA; las variables reservadas no habilitan IA por sí solas.

El Método AJ todavía requiere documentación del negocio: no se inventaron reglas. Los agentes producirán borradores y requerirán aprobación humana para mensajes, cotizaciones, cambios y movimientos financieros. Ver docs/arquitectura.md.

## Alcance y siguientes pasos

Esta entrega prepara la base; incluye listados/altas mediante API, relaciones y validación. Las pantallas de módulos son espacios iniciales. Pendientes: captura/edición/búsqueda en interfaz, autenticación y roles, auditoría de acciones, archivos en almacenamiento privado (Document guarda solo metadatos), worker WhatsApp, adaptador eve, observabilidad y políticas de respaldo. No desplegar la API interna con datos reales antes de completar autenticación y permisos.

Referencias: [Next.js](https://nextjs.org/docs/app), [Prisma PostgreSQL](https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/postgresql), [Meta Webhooks](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/create-webhook-endpoint), [eve](https://eve.dev/docs).
