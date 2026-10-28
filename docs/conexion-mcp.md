# Sistema AJ desde ChatGPT y Claude

Actualizado: 28 de octubre de 2026. Esta conexión trabaja con datos administrativos y archivos del CRM. No concede acceso al repositorio, al código ni a publicaciones.

## Conectar tu cuenta

1. Abre **Conexiones** en el CRM: https://crm.segurosaleyjoel.com/conexiones.
2. En la configuración de conexiones de tu aplicación, añade un servidor MCP remoto llamado **Sistema AJ** con esta dirección:

   `https://crm.segurosaleyjoel.com/mcp`

3. Usa la autorización OAuth que ofrezca el chat. Entra con la cuenta Google que ya tiene acceso al CRM y revisa el nombre de la aplicación y la dirección a la que volverás.
4. Empieza con **Consultar**. Puedes autorizar también propuestas de cambios y archivos si tu rol lo permite. La eliminación permanente requiere Superadmin. Mantener la conexión permite renovar el acceso; puedes retirarlo cuando quieras.
5. Prueba: «¿Qué permisos tengo en Sistema AJ?» y «Busca al cliente [nombre]». Después: «Prepara el cambio de su teléfono a [número confirmado]».
6. Abre **Revisar en el CRM**, comprueba el registro y confirma. Vuelve al chat y pide comprobar el estado de la propuesta.

Si una conexión existente solo permite consulta, pulsa **Actualizar herramientas** en la configuración del complemento y abre un chat nuevo. Pide «Usa Sistema AJ y solicita permiso para preparar cambios con `aj_request_change_access`». El servidor devuelve el desafío OAuth para pedir autorización adicional; en la pantalla de AJ marca **Proponer altas y cambios** y **Proponer cargas y organizar archivos**, y autoriza. Después pide comprobar tus permisos. «Permitir todo» en ChatGPT regula las confirmaciones de herramientas y no cambia los ámbitos del token. La pantalla de información del complemento no muestra un editor OAuth en todas las versiones; no prometer que existe ni modificar consentimientos directamente en la base para simular un token ampliado.

La disponibilidad de conexiones personalizadas y de componentes MCP Apps depende de la aplicación, cuenta, plan y administración de la organización. Si una aplicación requiere registro previo de cliente y no utiliza descubrimiento de cliente ni registro dinámico, se deberá preparar esa configuración específica. La primera conexión real en cada host sigue siendo una comprobación de aceptación del usuario; una prueba del protocolo no acredita esa interfaz particular.

No se necesitan claves de OpenAI o Anthropic nuevas para este servidor: la conversación usa el servicio de IA del chat que conectes. No copies tokens de Vercel, Google, R2 ni `AJ_API_TOKEN` en el chat.

## Permisos y alcance

| Permiso | Usuario | Administrador | Superadmin |
| --- | --- | --- | --- |
| `crm:read` | Consultar | Consultar | Consultar |
| `crm:write` | — | Proponer altas, ediciones, archivo y restauración | Igual |
| `crm:files` | — | Proponer cargas y organización | Igual |
| `crm:delete` | — | — | Proponer eliminación permanente |
| `offline_access` | Renovación opcional | Igual | Igual |

La cuenta debe seguir habilitada en AJ. El servidor comprueba su rol y consentimiento en cada petición. Las consultas tienen el mismo alcance de equipo del CRM; **no representan una partición de datos por broker**. Los cambios propuestos pertenecen exclusivamente a la persona y al cliente OAuth que los originaron; otro usuario, incluso otro administrador, no los confirma.

Se consultan prospectos, clientes, pólizas, cotizaciones, pagos, renovaciones, estado administrativo de siniestros, actividades, productos, documentos y carpetas. Una ficha de cliente incluye un resumen limitado de sus pólizas. Se devuelven campos explícitamente permitidos; no diagnósticos, narrativas clínicas, notas libres, datos bancarios, firmas, credenciales ni contenido de documentos. Los datos administrativos que sí consultes se compartirán con el chat y su proveedor: autoriza solo aplicaciones que el equipo haya decidido usar.

No se envían WhatsApp, correos o invitaciones. No se confirma un cobro sin el flujo de evidencia del CRM. Un siniestro que necesita descripción clínica debe darse de alta en su pantalla privada. Para borrar un producto con imagen utiliza su pantalla del catálogo. Los trámites de aseguradoras, plantillas, agenda, proveedores de IA y gestión de usuarios conservan sus accesos propios. La ficha general del cliente y la importación de contactos tienen herramientas específicas con revisión humana: [guía de importación y formularios](importacion-contactos.md).

## Cambios y archivos

- Toda escritura genera una propuesta inmutable con duración de **15 minutos**. No existe una herramienta MCP para confirmarla. La confirmación exige sesión humana del propietario y origen del CRM.
- Las ediciones son parciales: conservan los demás campos. Si alguien cambió el registro después de preparar la propuesta, se rechaza y hay que preparar una nueva.
- Confirmar dos veces la misma propuesta no repite la operación. La aplicación del cambio y su evento de auditoría se guardan en una transacción.
- Archivar conserva datos y archivos. La eliminación permanente respeta las dependencias y restricciones de la base.
- `aj_prepare_upload` acepta opcionalmente un archivo ya aportado por el usuario, codificado en base64 canónico, hasta **1 MiB**. Se valida el formato real, no solo su extensión. No descarga URLs ni consulta redes externas.
- Para archivos de hasta **4 MiB**, el asistente prepara el destino y el usuario selecciona el archivo en la revisión del CRM. La pantalla también puede sustituir el adjunto propuesto. El archivo llega al R2 privado después de confirmar.
- El adjunto de una propuesta se retira al aplicar, cancelar o revocar. Los adjuntos vencidos se purgan al usar MCP/Conexiones y en la limpieza diaria existente; sin actividad pueden permanecer hasta esa limpieza, no exactamente quince minutos. Las propuestas conservan metadatos para seguimiento.
- La descarga se abre con la sesión del CRM. No se entrega al modelo una URL pública ni una clave de almacenamiento.

## Herramientas y vistas

| Herramienta | Función |
| --- | --- |
| `aj_capabilities` | Rol, permisos, campos, límites y conexión |
| `aj_request_change_access` | Solicitar nueva autorización para cambios y archivos; no modifica registros |
| `aj_list` | Búsqueda paginada; máximo 25 registros |
| `aj_detail` | Registro administrativo; expediente con pólizas |
| `aj_propose_change` | Preparar alta, edición, archivo, restauración o eliminación |
| `aj_prepare_upload` | Preparar una carga privada y su destino |
| `aj_proposal_status` | Comprobar pendiente, aplicada, cancelada o vencida |
| `aj_file_access` | Abrir una descarga privada con sesión del CRM |
| `aj_prepare_intake` | Preparar enlace externo o borrador básico de ficha; confirmación en CRM |
| `aj_intake_status` | Estado y campos básicos faltantes; sin respuestas ni PIN |
| `aj_prepare_import` | Hasta 500 contactos desde filas o Excel/CSV; revisión por lotes |
| `aj_import_status` | Resumen paginado del lote e identificadores de altas aplicadas |

Los resultados incluyen `structuredContent` y una explicación breve. Las aplicaciones compatibles con MCP Apps muestran `ui://sistema-aj/crm.html`: tarjetas, datos del expediente, navegación y botón de revisión. La vista usa el puente oficial MCP Apps; no recibe cookies ni tokens ni hace peticiones de red directas. Los textos de registros se insertan como texto, nunca como HTML. Abrir un enlace y confirmar el cambio ocurre en el CRM.

## Implementación y mantenimiento

- Endpoint stateless Streamable HTTP `/mcp`; SDK oficial v2 con compatibilidad stateless para clientes 2025 y soporte de la revisión 2026.
- OAuth de Better Auth 1.7.7, PKCE S256, códigos de autorización y refresh rotatorio sin ventana de reutilización. JWT limitado a la audiencia `/mcp`, vida configurada de cinco minutos. No existe grant `client_credentials`.
- Descubrimiento RFC 9728 en `/.well-known/oauth-protected-resource/mcp` y RFC 8414 en `/.well-known/oauth-authorization-server/api/auth`.
- CIMD con transporte oficial que evita acceso a IP privadas y fija la resolución DNS. Registro dinámico RFC 7591 habilitado para hosts anteriores; registrar un cliente no autoriza ningún dato. Límite específico de diez registros por hora/IP según la identificación de IP de Better Auth y 120 peticiones MCP por minuto/usuario.
- Revocar elimina consentimientos, revoca refresh/access tokens persistidos, invalida JWT anteriores mediante una marca temporal y cancela las propuestas pendientes. Un JWT emitido en el mismo segundo de la revocación también se rechaza.
- Modelos añadidos: `Jwks`, tablas `Oauth*` del proveedor, `McpChange` y `McpRevocation`. Migración aditiva `20261028120000_mcp_connections`; no sustituye tablas ni datos existentes.
- Se reutilizan las operaciones del CRM dentro de la transacción de la propuesta, con bloqueo y comprobación de la versión original. La auditoría registra actor, cliente OAuth e identificador de propuesta, sin copiar credenciales ni contenido del archivo.
- La clave privada de firma la administra el plugin JWT con el secreto existente. No hay variables nuevas obligatorias. `BETTER_AUTH_URL` debe mantener el origen HTTPS canónico; `BETTER_AUTH_SECRET`, Google y PostgreSQL siguen siendo necesarios para el acceso existente; R2 para archivos.
- Los enlaces firmados del proveedor incluyen varios `ba_param`. Next.js los entrega como un arreglo: `oauthQuery` conserva todos sus valores antes de verificar la firma. Otros parámetros OAuth duplicados se rechazan; las páginas de entrada muestran cómo reiniciar una solicitud inválida. No quitar la firma, ampliar permisos ni reutilizar enlaces vencidos para resolver un fallo de conexión.
- Cada herramienta declara sus ámbitos OAuth en `securitySchemes` y su espejo `_meta.securitySchemes`. El catálogo usa el handler público del SDK porque la versión v2 no conserva extensiones desconocidas de descriptor. Si falta un ámbito que el rol vigente permite, la llamada devuelve `_meta['mcp/www_authenticate']` con `insufficient_scope`, descripción, metadatos y ámbitos requeridos; no crea propuestas ni datos. Los usuarios de consulta no reciben una invitación para adquirir permisos administrativos. Los tokens de consulta continúan siendo solo de consulta hasta completar una nueva autorización.

Comprobaciones:

```powershell
npm ci
npm run db:generate
npm run mcp:widget
npm run lint
npm run typecheck
npm test
npm run build
npm run mcp:smoke
```

`mcp:smoke` usa la base configurada pero encierra sus usuarios, sesiones, clientes, propuestas y consentimientos de prueba en una transacción que siempre revierte; el almacenamiento se simula. No llama a Google, ni envía mensajes, ni toca documentos reales. Exige Node 22.15+ por el cargador de pruebas. La regeneración de la vista requiere `esbuild`, instalado como dependencia de desarrollo; se versiona el HTML generado para no compilarlo en cada solicitud.

Referencias: [autenticación de aplicaciones de ChatGPT](https://developers.openai.com/plugins/build/auth), [UI con MCP Apps](https://developers.openai.com/plugins/build/chatgpt-ui), [conectores interactivos en Claude](https://support.claude.com/en/articles/13454812-use-interactive-connectors-in-claude), [plugin MCP de Better Auth](https://better-auth.com/docs/plugins/mcp).

## Siguiente prueba en el equipo

Conectar una cuenta real desde ChatGPT y otra desde Claude; comprobar consulta, tarjeta, propuesta, revisión humana, carga y revocación. Probar también una importación y una ficha con datos de prueba. Si el chat conserva el catálogo anterior, actualizar o volver a conectar para descubrir las herramientas nuevas. Después pueden ampliarse acciones de trámites o agenda mediante herramientas específicas y las mismas restricciones. No se debe añadir una herramienta genérica de SQL, HTTP arbitrario o ejecución de código.
