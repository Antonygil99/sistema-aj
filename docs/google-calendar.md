# Agenda y Google Calendar

Cada usuario autorizado puede abrir **Mi agenda**, conectar la misma cuenta Google con la que entra al CRM y crear reuniones o recordatorios en su calendario principal. Puede añadir hasta 20 participantes, solicitar invitaciones por correo, generar un enlace de Meet si Google admite conferencias en esa cuenta y seleccionar recordatorios de Calendar por correo o notificación. No necesita un calendario compartido ni una cuenta de servicio.

La lista incluye únicamente eventos creados por Sistema AJ para la persona autenticada. La sección de actividades ofrece hasta 50 actividades pendientes asignadas a su correo: «Agendar» prellena el título y la fecha sin cambiar su estado. Los horarios se capturan y presentan en Ciudad de México. «Ver / editar en Google» permite cambiar detalles en Google; «Actualizar desde Google» trae el título, descripción, ubicación, horario y enlace de Meet. Los recordatorios/invitados modificados directamente en Google no se importan todavía. No hay sincronización automática ni lectura de eventos personales ajenos al CRM.

## Google Cloud

Usar el proyecto y cliente OAuth del login existente. Habilitar **Google Calendar API** y declarar `https://www.googleapis.com/auth/calendar.events.owned` en Google Auth Platform → Data Access. El flujo conserva el callback registrado del login (`/api/auth/callback/google`): no requiere nuevas credenciales ni un nuevo redirect URI. La URL `/api/calendar/connected` es una redirección interna después del callback de Better Auth.

En cada conexión, el usuario concede el permiso de Calendar con `access_type=offline`, `prompt=consent` e `include_granted_scopes=true`. Google entrega las credenciales a Better Auth y sus tokens siguen cifrados en `AuthAccount`. La conexión comprueba los scopes, la existencia de un refresh token y una consulta mínima de Calendar sin descargar eventos personales. Las aplicaciones externas en Testing pueden requerir reconexión cada siete días. Publicar/verificar los permisos conforme a la configuración de Google.

## Seguridad y recuperación

Todas las rutas `/api/calendar` exigen una sesión autorizada; rechazan el token de integración. El propietario y la cuenta OAuth se resuelven en el servidor, y ninguna entrada permite seleccionar otra persona. Las mutaciones verifican el Origin existente. Better Auth mantiene estado OAuth, PKCE y la vinculación a la cuenta autenticada; solo se admite Google con el mismo correo. La conexión utiliza además un intento aleatorio de diez minutos, almacenado como hash y consumido una sola vez. Desconectar invalida los intentos pendientes.

Los endpoints HTTP de Better Auth que devuelven tokens (`get-access-token`, `refresh-token`) se bloquean. El código del servidor usa `auth.api.getAccessToken` con el identificador de cuenta obtenido de la base para renovar las credenciales. No se envían tokens al navegador ni se almacenan en variables de entorno nuevas.

Cada solicitud de creación lleva un UUID que genera un ID determinista por usuario. La reserva local precede a la creación en Google. Los reintentos conservan ID y contenido: un conflicto Google 409 recupera exclusivamente el evento marcado como propio, sin repetir el envío de invitaciones. Si Google o la base fallan temporalmente, queda un intento pendiente que se puede reintentar. Un rechazo HTTP 400 de Google se marca como fallido y se puede descartar. La cancelación es reintentable, incluso si Google ya eliminó el evento. Los estados locales no garantizan confirmación por los invitados ni recepción de recordatorios.

Desconectar detiene nuevas operaciones del CRM y conserva eventos, historial y credenciales cifradas para el login existente. No revoca globalmente el consentimiento Google compartido con el inicio de sesión; el usuario puede revocarlo desde su cuenta Google. Crear/cancelar reuniones y conectar/desconectar quedan en la auditoría privada del superadmin, excluidos del feed de notificaciones del equipo.

## Despliegue y validación

Aplicar `20261013120000_google_calendar` con `npm.cmd run db:verify-deploy` antes de publicar. Añade `CalendarConnection` y `CalendarMeeting`, con propietarios por usuario y relación opcional a `Activity`; no elimina datos. Ejecutar `npm.cmd run check`.

Las pruebas cubren validación, horarios, consentimiento explícito para invitaciones, aislamiento por persona, reintentos tras fallos, colisiones, cancelación y errores sanitizados, con transporte Google simulado. La comprobación real de autorización/creación requiere que el usuario conecte su cuenta en Google; no se crean reuniones ni se envían correos reales durante las pruebas automatizadas.

Referencias: [Google Calendar scopes](https://developers.google.com/workspace/calendar/api/auth), [creación de eventos](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert), [Better Auth Google](https://www.better-auth.com/docs/authentication/google).
