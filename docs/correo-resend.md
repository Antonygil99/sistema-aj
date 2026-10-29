# Correo con Resend

El CRM envía correo desde `avisos@segurosaleyjoel.com` (dominio verificado en Resend) por la API REST de Resend, sin SDK. Cada envío o recordatorio programado queda en la tabla `EmailMessage`, que sirve de historial por cliente y de control para mover o cancelar recordatorios.

## Qué se envía

| Correo | Quién lo dispara | Destinatarios | Cuándo |
| --- | --- | --- | --- |
| Documentos (pólizas, recibos, endosos) | Una persona en el expediente o en Documentos, botón «Enviar» | El cliente y/o sus contactos registrados | Al dar clic, después de revisar el texto y la vista previa |
| Bienvenida | Una persona en el expediente | El cliente y/o sus contactos | Al dar clic; puede llevar la póliza y los recibos adjuntos |
| Prospecto nuevo | Alta de un prospecto (hoy manual o por la integración; mañana los asistentes) | El responsable si opera el CRM; si no, todos los administradores | Al registrarse, después de responder la petición |
| Siniestro nuevo | Alta de un siniestro | El responsable de la póliza o todos los administradores | Igual que el anterior; nunca incluye la descripción del siniestro |
| Recordatorios de agenda | Crear, actualizar o cancelar una reunión en Mi agenda | La persona dueña de la reunión | 1 día antes, a las 8:00 (Ciudad de México) del mismo día si la reunión empieza a las 9:00 o después, y 10 minutos antes |
| Resumen diario | Tarea diaria (~07:00 Ciudad de México) | Cada administrador con el resumen activo | Su agenda del día, avisos a clientes por revisar, seguimientos de entrega para hoy o atrasados, pólizas que vencen en 30 días, recibos de la semana o vencidos y siniestros abiertos de su cartera (lo que no tiene responsable lo ven todos). Si no hay nada, no se envía |
| Renovación, pago y seguimiento de siniestro | Avisos a clientes, botón «Enviar correo» | El cliente y/o sus contactos | Cuando una persona lo decide; el aviso queda marcado como enviado |

Reglas:

- **Nada sale hacia un cliente o contacto sin clic.** Los correos a clientes los envía una persona (ADMIN) después de revisarlos. Los avisos internos al equipo sí son automáticos.
- **Destinatarios acotados.** Un correo de cliente solo puede ir a su correo o a sus contactos registrados (`ClientContact`); para escribir a alguien nuevo hay que agregarlo primero como contacto. El servidor lo vuelve a comprobar (422 `EMAIL_RECIPIENT_NOT_ALLOWED`).
- **Adjuntos.** Solo archivos del expediente (directos o de sus pólizas y siniestros) o archivos generales del equipo, nunca de otro cliente (422 `EMAIL_DOCUMENT_NOT_ALLOWED`). Hasta 10 archivos y 20 MB en total. Se leen de R2 en el servidor; el navegador nunca ve las llaves del almacenamiento.
- **Remitente y respuestas.** Los correos a clientes salen como «Nombre de quien envía · AJ Consultoría de Seguros» y las respuestas llegan a su correo (`reply_to`), porque el dominio solo envía. Los avisos internos salen como «Sistema AJ».
- **Sin duplicados.** El redactor manda un `requestId`; repetirlo devuelve el mismo correo. Los avisos y recordatorios usan una llave única (`dedupeKey`) y Resend recibe una `Idempotency-Key` por envío.
- **Preferencias.** En Preferencias → Notificaciones → Por correo cada persona puede apagar el resumen diario, los avisos de prospectos, de siniestros y los recordatorios de agenda. Apagar los recordatorios cancela los que estaban programados la siguiente vez que se sincroniza la reunión.
- **Textos sugeridos.** Cada correo a clientes trae un texto neutro (editable por el equipo en Plantillas) que se revisa antes de enviar. No prometen coberturas ni usan frases del Método AJ; esas las define Ale.

## Avisos a clientes (fase 2)

La pantalla `/avisos` («Avisos a clientes» en el menú) reúne lo que conviene avisar hoy a cada cliente. La tarea diaria y cada apertura de la pantalla generan los avisos (`ClientNotice`, reglas puras en `src/modules/email/notices.ts`):

- **Renovación:** pólizas activas que vencen en 30, 20 o 10 días, sin una renovación marcada como renovada.
- **Pago:** recibos no pagados a 20 y 10 días de su vencimiento, el mismo día y hasta 3 días después.
- **Siniestro:** cada semana completa que un siniestro siga abierto.

Cada hito aparece una sola vez (aunque se descarte). Un aviso pendiente expira solo cuando su registro ya no aplica (recibo pagado, póliza renovada o cancelada, siniestro cerrado) o cuando llega el siguiente hito del mismo registro. Para cada aviso, una persona (ADMIN) puede **enviar el correo sugerido** (abre el redactor con la plantilla llenada con los datos de la póliza, el recibo o el siniestro), **registrar que ya le avisó** por llamada, WhatsApp, en persona u otro medio (con nota opcional) o **descartarlo**; las dos últimas se pueden deshacer. Un recibo importado del control de pólizas muestra que aún no está conciliado. Si el cliente no tiene correo ni contactos con correo, el aviso lo indica y ofrece su teléfono.

«A mi cargo» muestra los avisos de las pólizas de la persona y los que no tienen responsable; «Todo el equipo», todos. Abajo quedan los resueltos de los últimos 14 días.

## Plantillas de correo

En Avisos a clientes → Plantillas de correo (ADMIN) el equipo edita el asunto y el texto de la bienvenida, documentos, renovación, pago y seguimiento de siniestro (`EmailTemplate`; los textos sugeridos están en `src/modules/email/template-text.ts`). Admiten marcadores como `{cliente}`, `{poliza}`, `{producto}`, `{aseguradora}`, `{vence}`, `{dias}`, `{monto}`, `{referencia}` y `{asesor}`; uno desconocido se rechaza. Un texto entre corchetes con la palabra «escribe» (como el estado del siniestro) debe completarse antes de enviar. La plantilla es solo el punto de partida: quien envía siempre puede editarla. «Volver al texto sugerido» borra el texto del equipo.

## Recordatorios de agenda

Resend programa correos hasta 30 días antes (`scheduled_at`) y permite cancelarlos. Al crear, actualizar (botón «Actualizar» de la agenda) o cancelar una reunión, `syncMeetingReminders()` compara lo programado con lo que la reunión necesita: si cambian la hora o el contenido (título, lugar, enlace de Meet) cancela y vuelve a crear el aviso, porque el texto incluye la hora. La tarea diaria `GET /api/cron/email` (07:00 en Ciudad de México, `vercel.json`) programa los recordatorios de reuniones que acaban de entrar en la ventana de 30 días, limpia los de reuniones canceladas, actualiza los avisos a clientes y envía el resumen diario. Usa `CRON_SECRET`, como la limpieza de logs; el token interno también puede ejecutarla a mano.

## Estado de entrega (webhook)

`POST /api/emails/webhook` recibe los eventos de Resend (enviado, entregado, rebotó, marcado como spam, falló) y actualiza el historial; el estado solo avanza. Está firmado con Svix y se verifica con `RESEND_WEBHOOK_SECRET`. Sin esa variable la ruta responde 503 y el historial se queda en «Enviado».

Para activarlo: en Resend → Webhooks, crear un endpoint `https://crm.segurosaleyjoel.com/api/emails/webhook` con los eventos `email.sent`, `email.delivered`, `email.bounced`, `email.complained`, `email.failed` y `email.suppressed`, copiar su *signing secret* (`whsec_…`) a `RESEND_WEBHOOK_SECRET` en Vercel (Production) y volver a desplegar.

## Variables

| Variable | Uso |
| --- | --- |
| `RESEND_API_KEY` | Llave de la API (obligatoria para enviar). Sin ella el redactor avisa que el correo no está configurado y los avisos automáticos se omiten. |
| `RESEND_FROM_ADDRESS` | Opcional; por defecto `avisos@segurosaleyjoel.com`. Debe pertenecer a un dominio verificado. |
| `RESEND_WEBHOOK_SECRET` | Secreto del webhook de estados (`whsec_…`). |
| `AJ_PRIVACY_URL` | Opcional; si existe, el pie de los correos a clientes enlaza el aviso de privacidad (solo `https`). |
| `CRON_SECRET` | Ya existente; autoriza las tareas programadas. |

## Límites del plan

El plan gratuito de Resend permite 100 correos al día y 3,000 al mes; cada destinatario cuenta por separado y cada reunión usa hasta 3. Si se alcanza el límite, el envío responde 429 `EMAIL_RATE_LIMITED` y el redactor lo explica.

## Código y pruebas

- `src/integrations/resend/client.ts`: cliente REST puro (`fetch` inyectable) con traducción de errores sin exponer mensajes de Resend.
- `src/modules/email/templates.ts`: plantillas HTML y texto (puras; el redactor las usa para la vista previa). Todo valor del CRM se escapa.
- `src/modules/email/rules.ts`: destinatarios permitidos, horarios y plan de recordatorios, estados del webhook y destinatarios del equipo.
- `src/modules/email/webhook.ts`: verificación de la firma Svix.
- `src/modules/email/server.ts`: envío, contactos, avisos, recordatorios y eventos (server-only).
- `tests/email.test.ts` cubre lo anterior sin red. La integración se probó contra Resend real enviando solo a `delivered@resend.dev` con una base local: bienvenida entregada, aviso de prospecto entregado, tres recordatorios programados y luego cancelados, y un evento firmado del webhook.

## Pendiente

- **Datos:** solo 11 de 448 clientes tienen correo (octubre de 2026) y aún no hay recibos cargados; los avisos de renovación ya aparecen, pero la mayoría se resolverán por teléfono hasta completar correos y contactos. Los avisos de pago dependen de conciliar los recibos.
- **Fase 3:** los mismos avisos disparados por los asistentes de WhatsApp y la recepción de respuestas de clientes dentro del CRM (Resend ofrece recepción).
- Marcar como inválido el correo de un cliente cuando rebota.

## Ampliación del 29/10/2026: editor y plantillas por asesor

- Avisos → Plantillas: catálogo personal ADMIN/SUPERADMIN, hasta 100 plantillas por cuenta, nombre, tipo, asunto y cuerpo. Una predeterminada por tipo. Los textos compartidos existentes se conservan como sugerencias: editar una copia en el nuevo editor no los sobrescribe. API `/api/broker-email-templates` exige sesión humana y filtra propietario en lecturas, edición y borrado. La versión evita sobrescribir cambios simultáneos; una transacción serializa la selección de predeterminada.
- Editor visual con variables como chips no editables, negrita, cursiva, listas y enlaces HTTPS. Guarda un formato de texto limitado, no HTML arbitrario. El render de correo escapa HTML y rechaza enlaces activos peligrosos; pegado como texto y sin arrastrar contenido HTML. La versión de texto simple conserva los enlaces y elimina marcas de formato.
- Cada tipo solo admite sus variables permitidas. Cambiar el tipo puede requerir quitar chips que ya no correspondan. La vista previa de plantillas usa datos de ejemplo, no de clientes reales.
- Desde Expediente → Correos → Escribir correo, se puede elegir una plantilla y editar libremente, con o sin adjuntos. Elegir póliza y recibo comprueba en servidor que pertenecen al cliente. Los avisos conservan su contexto y no admiten cambiarlo por otro recibo/póliza. Variables pendientes bloquean el envío. La firma y el reply-to siguen siendo los del asesor que envía.
- Tiempos personales en Avisos → Plantillas → Tiempos de mis avisos: renovación 1–180 días, pagos 0–180 días (0 = mismo día), hasta cinco umbrales únicos; siniestros cada 1–90 días. Aplica el calendario del responsable de la póliza; sin responsable usa los valores del sistema. Las configuraciones no cambian ni reenvían lo ya enviado/atendido; los pendientes se reevaluan al abrir/actualizar Avisos o en el cron existente. El resumen interno 60/45/30 es una preferencia separada.
- No activa campañas, envío automático al cliente, nuevos cron ni medios de pago. Se conservan destinatarios registrados, control de adjuntos y verificación humana de identidad/autorización al entregar documentos.
- Pruebas con SQL/sesiones temporales: catálogo aislado por asesor, edición ajena denegada, predeterminada única, revisión de versiones, datos de póliza de otro cliente rechazados y variables pendientes bloqueadas; todo con rollback. Navegador con componentes reales: chips/selección/formato, creación de plantilla y envío manual individual con API simulada. No se enviaron correos reales.
- Migración aditiva `20261029230000_broker_email_templates`; ninguna plantilla compartida o correo histórico se elimina por migrarla.
