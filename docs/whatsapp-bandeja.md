# Bandeja de WhatsApp

Acceso: `/whatsapp` (sesión Google y acceso del equipo requeridos). USER consulta; ADMIN y SUPERADMIN pueden responder, sincronizar eventos y marcar conversaciones resueltas. Una respuesta nueva reabre la conversación. Estos permisos siguen el alcance de equipo del CRM: no hay aislamiento por broker todavía.

## Flujo

1. Meta verifica el callback y firma los POST con `WHATSAPP_APP_SECRET`.
2. El evento se conserva en WebhookEvent por hash; su proyección transaccional crea conversaciones separadas por número empresarial y contacto. Cada mensaje de Meta tiene una clave única. Las muestras antiguas del panel no crean contactos reales.
3. Si falla la proyección, el endpoint responde con error para permitir reintentos de Meta. El evento permanece pendiente. «Actualizar recibidos» procesa hasta 100 pendientes; se puede repetir sin duplicar mensajes.
4. Se muestran textos y tipo/caption de multimedia; no se descargan ni sirven archivos privados de Meta todavía.
5. Una persona revisa y pulsa «Enviar respuesta». Solo se permite texto dentro de 24 horas del último mensaje del contacto. No se envían plantillas ni campañas.
6. Cada envío tiene un requestId único, destinatario tomado del servidor y número empresarial verificado contra configuración. No se confía en números suministrados por el navegador. Las solicitudes duplicadas no vuelven a llamar a Meta.
7. «Aceptado por Meta» no significa entregado. Los callbacks actualizan enviado, entregado, leído o fallo. Los recibos se conservan incluso si llegan antes que la respuesta del envío.

## Configuración

Para la discrepancia de México entre identificadores entrantes `521` + 10 dígitos y destinatarios de prueba `52` + 10 dígitos, el envío conserva primero el identificador de Meta. Solo después de un rechazo explícito 131030 se permite un único intento al equivalente E.164 sin el 1 móvil legado. No cambia el contacto, no fusiona conversaciones, no afecta otros países ni formatos, y no se ejecuta después de una aceptación, timeout o error ambiguo. Ambos intentos pertenecen al mismo requestId y al mismo mensaje. Si también se rechaza el equivalente, se muestra el error; no hay más alternativas automáticas.

La UI muestra el formato E.164 mexicano sin el 1 legado; la búsqueda por teléfono contempla ambos formatos sin modificar identidades. Esto no resuelve un error 131005: en ese caso debe verificarse el permiso de mensajería y el acceso del token a la cuenta/número. Una consulta de número exitosa no prueba el permiso de envío. Probar primero desde Paso 1 de Meta con el token generado para esa misma app y cuenta permite separar el bloqueo del proveedor de los cambios del CRM.

- WHATSAPP_VERIFY_TOKEN y WHATSAPP_APP_SECRET: verificación y firma entrante.
- WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID y WHATSAPP_API_VERSION: envío manual. No guardar tokens en Git ni capturas. Los tokens temporales caducan: sustituir por credenciales de sistema con permisos mínimos para producción.
- Vincular la app a la cuenta mediante `POST /{WABA_ID}/subscribed_apps` y comprobar con GET; mantener el campo `messages` suscrito. La publicación de la app no equivale a aprobación como proveedor ni a elegibilidad para coexistencia.
- Un envío ambiguo (timeout/servidor de Meta sin confirmación) no se reintenta: queda UNKNOWN y bloquea nuevos envíos de esa conversación para evitar duplicados. Requiere conciliación por el administrador contra Meta. No hay botón para forzar reenvío ni proceso automático de conciliación todavía. Un fallo de guardado tras aceptación puede dejar SENDING y requiere la misma revisión.

## Despliegue y recuperación

Migración aditiva `20261023020000_whatsapp_inbox`: conversaciones, mensajes y recibos. Ejecutar `npm run db:deploy` antes de publicar la aplicación. No borra ni sustituye datos existentes. Para proyectar eventos previos sin enviar mensajes:

```powershell
node --conditions=react-server --import tsx scripts/whatsapp-sync.ts
```

La bandeja consulta cada 15 segundos mientras la pestaña está visible. Lista paginada de 30 contactos e historial de 50 mensajes por página. Una pérdida de conexión no debe presentarse como bandeja vacía.

## Pendientes explícitos

Se mantiene atención humana por decisión del usuario. No hay respuestas automáticas, llamadas a modelos ni borradores generados por IA en esta bandeja. Los asistentes existentes siguen separados y necesitan proveedor configurado. Faltan autorización/coexistencia de cada broker, credenciales por cuenta, asignaciones y permisos por broker, vincular expedientes, medios descargables, plantillas aprobadas, recibos/renovaciones automáticos y conciliación de envíos ambiguos.

El webhook de ecos de la app del teléfono y el historial de coexistencia se ignoran para evitar que se traten como mensajes entrantes o que una IA se responda a sí misma. Deberán integrarse con dirección y permisos explícitos cuando Meta apruebe el flujo.

## Verificación

«Comprobar conexión» usa una consulta autenticada y de solo lectura a Meta para verificar si el token puede consultar el número configurado. No envía mensajes y no certifica por sí sola permisos de mensajería. Los rechazos guardan únicamente `META_<código>` o `HTTP_<estado>`; no se guardan mensajes de error originales de Meta, tokens ni trazas. Los fallos anteriores que solo guardaron un estado HTTP no permiten reconstruir el motivo. La UI distingue códigos de token, permisos, destinatario de prueba, ventana, registro y cuenta, y conserva la protección contra reenvíos ambiguos.

`npm test` incluye pruebas de lectura de payloads, exclusión de muestras y ecos, estados fuera de orden, ventana de 24 horas y envío con persistencia/proveedor simulados (destinatario, idempotencia, rechazo y timeout). `npm run whatsapp:smoke` contrasta las lecturas API con SQL, comprueba autenticación, validación, desafío y rechazo de firmas falsas. No envía mensajes ni modifica datos de negocio. La revisión visual usa el componente real con contactos ficticios; nunca publicar sus muestras en la cartera.
