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

Reglas:

- **Nada sale hacia un cliente o contacto sin clic.** Los correos a clientes los envía una persona (ADMIN) después de revisarlos. Los avisos internos al equipo sí son automáticos.
- **Destinatarios acotados.** Un correo de cliente solo puede ir a su correo o a sus contactos registrados (`ClientContact`); para escribir a alguien nuevo hay que agregarlo primero como contacto. El servidor lo vuelve a comprobar (422 `EMAIL_RECIPIENT_NOT_ALLOWED`).
- **Adjuntos.** Solo archivos del expediente (directos o de sus pólizas y siniestros) o archivos generales del equipo, nunca de otro cliente (422 `EMAIL_DOCUMENT_NOT_ALLOWED`). Hasta 10 archivos y 20 MB en total. Se leen de R2 en el servidor; el navegador nunca ve las llaves del almacenamiento.
- **Remitente y respuestas.** Los correos a clientes salen como «Nombre de quien envía · AJ Consultoría de Seguros» y las respuestas llegan a su correo (`reply_to`), porque el dominio solo envía. Los avisos internos salen como «Sistema AJ».
- **Sin duplicados.** El redactor manda un `requestId`; repetirlo devuelve el mismo correo. Los avisos y recordatorios usan una llave única (`dedupeKey`) y Resend recibe una `Idempotency-Key` por envío.
- **Preferencias.** En Preferencias → Notificaciones → Por correo cada persona puede apagar los avisos de prospectos, de siniestros y los recordatorios de agenda. Apagar los recordatorios cancela los que estaban programados la siguiente vez que se sincroniza la reunión.
- **Textos sugeridos.** La bienvenida y el correo de documentos traen un texto neutro que se edita antes de enviar. No prometen coberturas ni usan frases del Método AJ; esas las define Ale.

## Recordatorios de agenda

Resend programa correos hasta 30 días antes (`scheduled_at`) y permite cancelarlos. Al crear, actualizar (botón «Actualizar» de la agenda) o cancelar una reunión, `syncMeetingReminders()` compara lo programado con lo que la reunión necesita: si cambian la hora o el contenido (título, lugar, enlace de Meet) cancela y vuelve a crear el aviso, porque el texto incluye la hora. La tarea diaria `GET /api/cron/email` (07:00 en Ciudad de México, `vercel.json`) programa los avisos de reuniones que acaban de entrar en la ventana de 30 días y limpia los de reuniones canceladas. Usa `CRON_SECRET`, como la limpieza de logs; el token interno también puede ejecutarla a mano.

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

- **Fase 2:** recordatorios de siniestros sin cerrar, resumen diario del equipo y avisos de renovación (30/20/10 días) y pago (20/10/0) a clientes con una cola de aprobación, después de conciliar los recibos. Plantillas editables por Ale con vista previa.
- **Fase 3:** los mismos avisos disparados por los asistentes de WhatsApp y la recepción de respuestas de clientes dentro del CRM (Resend ofrece recepción).
- Marcar como inválido el correo de un cliente cuando rebota.
