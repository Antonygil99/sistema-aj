# Ficha del cliente: captura manual, WhatsApp y enlace externo

Implementado el 27/10/2026. Esta fase comparte datos administrativos por cliente. La generación de los ocho formatos de aseguradora, firma electrónica y captura de información médica/bancaria sigue siendo un trabajo posterior.

## Cómo se usa

1. En Clientes / Expedientes, abrir al cliente y desplegar **Ficha del cliente · formulario y WhatsApp**.
2. Capturar manualmente o crear un enlace externo. La misma ficha puede recibir una nueva revisión sin duplicar al cliente.
3. Copiar el enlace y código o **Copiar mensaje para la bandeja** y pegarlo en WhatsApp del CRM. **Abrir WhatsApp para compartir** prepara un mensaje en la aplicación de WhatsApp: una persona lo revisa y envía. Crear el enlace no manda mensajes ni correos.
4. El cliente abre `/completar#<secreto>`, introduce el código y llena el formulario desde el móvil o computadora, sin crear cuenta Google.
5. Al enviar, las respuestas quedan en `SUBMITTED`. El nombre, correo, teléfono y RFC actuales del cliente no cambian aún. En Expedientes aparece un bloque de fichas pendientes de revisión (hasta 10 de las accesibles, las más antiguas primero).
6. Revisar la ficha completa, seleccionar cuáles de esos cuatro campos copiar y confirmar la revisión. Los campos vacíos no borran los datos principales. Domicilio, nacimiento, intereses y vehículo quedan en la ficha aprobada para reutilización futura. No se modifican pólizas ni responsables a partir del interés elegido.

Se recoge nombre/razón social y al menos un contacto; opcionalmente RFC, nombres separados, nacimiento, ocupación, domicilio e información básica del vehículo. Se diferencia al cliente de quien le ayuda a capturar. Las casillas de privacidad y veracidad empiezan vacías cada vez. No se pide CURP, historia clínica, diagnóstico, cuentas, datos de tarjetas o firmas en esta fase. La aceptación administrativa de la ficha no sustituye las autorizaciones particulares de la aseguradora.

## Acceso y límites

- Una fila `ClientIntake` por cliente (`clientId` único); revisiones inmutables en `ClientIntakeRevision` por número de revisión. `approvedAnswers` conserva el último perfil aprobado aunque se prepare otro borrador.
- Cada enlace usa un secreto aleatorio de 32 bytes y código aleatorio de 8 dígitos. Solo se muestran al crearlos. Se guardan hash SHA-256 del secreto y hash scrypt del código con sal por enlace. No se almacenan códigos o enlaces completos en auditoría.
- Enlace válido por 7 días; renovar revoca enlace y sesiones anteriores. Revocar no elimina las respuestas ni su historial. La ficha es reutilizable; el enlace no es permanente.
- Cinco intentos incorrectos bloquean la comprobación 15 minutos. Se cuenta en PostgreSQL bajo bloqueo de fila. La sesión de captura dura como máximo una hora y termina al enviar. Una nueva verificación deja una sola sesión activa por ficha.
- La cookie es HttpOnly, SameSite Strict y Secure en producción, con alcance `/api/intake`. El secreto del enlace va en el fragmento, no en ruta/query, y se retira de la barra tras abrir la ficha. Las respuestas API son `no-store`; la página no se indexa ni admite marcos externos. El bloqueo no demuestra identidad documental; el asesor debe compartir el acceso solo con la persona autorizada.
- Sin datos de cliente antes de comprobar enlace y código. Tras comprobarlo solo se devuelve la última captura de esa ficha y revisión, no cartera, pólizas, contactos relacionados ni datos maestros ajenos.
- ADMIN con sesión humana: creador de la ficha o responsable de una póliza no archivada del cliente. SUPERADMIN: todas. Antes de crear una ficha sin responsables asignados, un ADMIN puede iniciarla; a partir de ahí rige el creador/responsables. USER y token interno de integración no acceden. Los datos administrativos generales del CRM conservan sus permisos previos.
- Mutaciones públicas requieren el Origin exacto de `BETTER_AUTH_URL`, JSON y cuerpo máximo de 16 KiB. No reutilizar una URL temporal de Vercel con otro origen esperando que pase esta comprobación.
- Versiones y campos permitidos se validan en servidor. Reintentar la misma revisión no crea duplicados. Edición simultánea muestra conflicto; actualizar antes de reintentar. Valores médicos y bancarios adicionales se rechazan como campos no admitidos.

## Asistentes y WhatsApp

Se añadieron `estado_ficha_cliente` y `preparar_ficha_cliente` a Primer contacto y Siniestros. El primero devuelve estado/revisión/enlace interno, sin respuestas, enlaces públicos ni códigos. El segundo solo admite ID de cliente, revisión esperada, nombre y contacto confirmados; una persona confirma la propuesta antes de persistirla como `DRAFT`, origen `ASSISTANT`. No obtiene consentimiento por el cliente y no reemplaza respuestas ya recibidas pendientes de revisión.

Los demás orígenes son `MANUAL` y `EXTERNAL`. Ambas capturas usan el mismo `profileSchema`; para aprobar se exige revisión explícita. El agente no maneja domicilio, RFC, cumpleaños o respuestas completas mediante estas herramientas. Los logs de `AgentRun` siguen sujetos a las restricciones del chat general: no pegar información de salud ni bancaria.

Esto no activa un bot automático de WhatsApp ni crea una clave/modelo IA. La bandeja manual existente permite compartir el enlace; los asistentes usan el proveedor que ya tenga habilitado el proyecto. La futura atención automática debe reutilizar este servicio y mantener su revisión, sin simular una respuesta del cliente o su consentimiento.

## Archivos y rutas

- `src/modules/intake/schema.ts`, `tokens.ts`, `server.ts`, `http.ts`.
- `src/components/client-intake-panel.tsx`, `intake-profile-form.tsx`, `public-intake.tsx`, `intake.css`.
- Público: `GET /completar`, `POST/DELETE /api/intake/access`, `GET/POST /api/intake/profile`.
- Equipo: `GET/POST /api/dossiers/:id/intake`, `POST/DELETE .../link`, `POST .../approve`.
- Migración aditiva: `20261027010000_client_intake`; no elimina ni convierte clientes existentes. No se envían invitaciones masivas ni se generan enlaces para toda la cartera automáticamente.
- Privacidad: `/privacidad` describe esta captura. Auditoría de creación/revocación, recepción y aprobación sin copiar respuestas ni códigos al evento.

## Verificación

Pruebas de validación, consentimiento, datos no permitidos, hashes/código, Origin y tamaño. `node --conditions=react-server --import tsx scripts/intake-smoke.ts` verifica en una transacción revertida alcance del asesor, bloqueo de código, captura pública, aprobación selectiva, borrador de asistente, versiones, rotación, vencimiento y revocación. No manda mensajes.

También se verificó el recorrido real de navegador local -> API -> PostgreSQL -> revisión, con un cliente sintético temporal retirado al terminar. La interfaz del equipo se comprobó con respuestas simuladas, incluyendo móvil y tema oscuro. No se usaron datos de clientes para las pruebas ni se enviaron mensajes de WhatsApp.

Siguiente fase: identidad/roles por asegurado y trámite, anexos, CFDI XML, mapas PDF revisados por versión y flujo de firmas aceptado por cada aseguradora. Consultar `CONTEXTO-AGENTES.md` para el análisis del catálogo completo.
