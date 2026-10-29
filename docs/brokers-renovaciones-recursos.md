# Entrega de los seis puntos acordados

29 de octubre de 2026. Implementación basada en la [revisión de la reunión](reuniones/2026-10-28-necesidades-brokers.md). La aprobación de Meta y la conexión efectiva de los números reales son dependencias externas, no resultados de esta entrega.

## 1. Canales y bandejas privadas

- `/whatsapp` muestra únicamente conversaciones de canales habilitados cuyo `ownerEmail` corresponde a la sesión. Las lecturas, contadores, búsqueda, historial, respuesta y cierre/reapertura aplican el mismo alcance. Una integración sin identidad humana no recibe bandejas.
- `/whatsapp/canales` permite al superadmin administrar metadatos, responsables y el espacio de credenciales de cada canal. Administrar canales **no permite leer conversaciones ajenas**; tampoco hay una excepción de supervisión global para el superadmin.
- Los canales Ale/Joel usan `WHATSAPP_TOKEN_ALE` y `WHATSAPP_TOKEN_JOEL`, con la versión común `WHATSAPP_API_VERSION`. El espacio GENERAL reutiliza las variables anteriores únicamente si el ID asignado coincide exactamente con el número configurado.
- El token nunca se guarda en `WhatsAppChannel`, se solicita en el formulario o se devuelve al navegador. La pantalla diferencia número pendiente, credencial pendiente y credencial configurada; la lectura de un número no acredita permiso de envío.
- Se prepararon los canales de Ale y Joel con número pendiente. Los registros existentes se preservan; no se asignó el número de prueba a ningún broker.
- El webhook firmado conserva los eventos y el historial, incluidos números todavía sin asignar. No se transfieren conversaciones por coincidencias de contactos ni se asigna el número de prueba automáticamente.
- El asistente consulta mensajes ya proyectados y filtrados por canal, no eventos crudos de toda la empresa. La actividad de WhatsApp se conserva para auditoría pero se excluye del feed y de la consulta de auditoría global para evitar mostrar actividad de bandejas ajenas.
- La bandeja continúa con atención humana y conserva la ventana de respuesta, idempotencia y bloqueo de envíos ambiguos.

## 2. Preparar renovación antes de comunicar

En una póliza, abrir **Recibos, pagos y renovación → Preparar renovación**. Guarda una preparación independiente de la vigencia original:

1. Seleccionar la carátula anterior y la carátula/cotización nueva del mismo expediente.
2. Capturar el número completo, prima total, moneda, fechas y notas de pagos revisados.
3. Generar y editar un resumen comparativo. El porcentaje requiere dos primas positivas de la misma moneda; UDI queda para revisión especializada.
4. Marcar **Revisada y lista para comunicar**, confirmando documentos y datos.
5. Copiar el resumen y abrir el expediente para usar el redactor existente. El envío requiere su clic habitual. Después se puede registrar el medio y referencia de la comunicación efectivamente realizada.

Los avisos y el resumen diario existentes siguen siendo internos para el responsable. La preparación no emite una nueva póliza, altera primas históricas, crea recibos ni confirma pagos. El registro de una nueva vigencia sigue siendo una operación separada, con sus validaciones financieras. Se comprueba la versión de la póliza y la preparación para evitar sobrescribir cambios simultáneos.

## 3 y 4. Carátulas y número completo

En el paso **Póliza** del alta de expediente o de una póliza adicional aparece **Completar desde una carátula**:

- PDF de hasta 10 páginas o JPEG/PNG/WebP, hasta 4 MiB. Se valida contenido y formato en el servidor.
- El administrador autoriza expresamente procesar el archivo con el proveedor de IA configurado. Se respeta el modelo de sus preferencias, sin sustituirlo silenciosamente por otro proveedor. Requiere la llave correspondiente de Anthropic u OpenAI; sin ella la captura manual sigue disponible.
- La respuesta se limita a datos administrativos y evidencia por campo. Fechas ambiguas y campos sin lectura segura quedan pendientes; el contratante no sustituye al cliente seleccionado.
- El número se trata como texto completo, con ceros, prefijos y separadores. No se inventan prefijos a partir del producto, mensualidades, coberturas ni estados de pago.
- Al aplicar una lectura se reemplazan los campos de la póliza y los desconocidos quedan vacíos. Moneda y periodicidad no leídas requieren confirmación; no se conservan valores de una carátula anterior.
- El usuario compara la lectura con el documento antes de llevar los valores al formulario. Todavía debe revisar el calendario contractual y guardar el alta.
- Al guardar, la carátula se adjunta a la póliza mediante R2. Si el registro se guardó pero el adjunto falla, la UI conserva el ID y permite reintentar el archivo sin crear otra póliza; también permite abrir el expediente ya guardado.
- La extracción no persiste transcripciones ni el documento en tablas auxiliares. Se envía al proveedor para la lectura solicitada y luego al almacenamiento privado cuando el usuario guarda. El procesamiento externo está sujeto a la configuración y políticas del proveedor; no se promete retención cero de terceros.
- Hasta diez lecturas por usuario por hora, sin reintentos automáticos del proveedor. OpenAI usa `store:false`. No se ejecutan instrucciones o herramientas escritas en el archivo.

## 5. Recursos

**Más → Recursos** reúne enlaces de pago, calculadoras, comparativas y guías. Los administradores pueden crear, editar y desactivar; las cuentas de consulta solo ven recursos activos.

Los recursos son internos por defecto. La audiencia **Clientes: catálogo público** requiere una casilla de revisión expresa, también al editar. `/recursos-publicos` consulta únicamente registros públicos activos y devuelve una proyección sin propietarios ni metadatos internos. Los enlaces deben usar HTTPS y no contener usuario/contraseña. El servidor no visita los enlaces ni interpreta una visita como pago.

No se cargaron enlaces inventados de aseguradoras ni se publicaron herramientas privadas durante la implementación. El catálogo se alimenta con los enlaces aprobados del equipo. La página pública puede enlazarse desde el sitio comercial; no se modificó otro repositorio o sitio web.

## 6. Estado claro del MCP

Las tarjetas distinguen propuesta pendiente, aplicada, cancelada y vencida. `aj_proposal_status` informa si se guardó y la acción siguiente. La tarjeta permite comprobar el estado y, tras aplicar, consultar los datos guardados con `aj_detail`; el enlace al CRM abre el registro mediante `?open=ID` cuando corresponde.

Preparar no es guardar. La confirmación sigue perteneciendo a la persona que preparó la propuesta; Ale y Joel no requieren autorización adicional de Tony para confirmar sus propias propuestas. El MCP sigue sin acceso a código o despliegues. El bucle de reconexión de Android sigue siendo una investigación independiente; esta entrega no lo declara resuelto.

## Base de datos y verificación

Migración aditiva `20261029180000_broker_channels_and_workflows`: `WhatsAppChannel`, `RenewalPreparation` y `CrmResourceLink`, con claves e índices. No elimina tablas ni cambia números históricos.

Verificaciones:

- `npm run check`: esquema, lint, tipos, pruebas y compilación.
- `npm run brokers:smoke`: SQL real y sesiones humanas temporales; listas/contadores privados, rechazo de hilo/cierre/respuesta ajenos, prohibición de administrar canales desde un broker, conservación del historial deshabilitado, documentos de renovación, versiones, primas/pagos intactos, revisión de publicación y exclusión de enlaces internos del catálogo anónimo. Todas las muestras se revierten; no envía mensajes externos.
- `npm run mcp:smoke`: autorización y propuestas del conector en una transacción descartable.
- Navegador con componentes reales y API simulada: recorrido ilustrado sin mutaciones, recursos, comparación/revisión de renovación, consentimiento/evidencia de carátula, número completo, recuperación del adjunto sin alta duplicada y estados MCP; escritorio y móvil oscuro.
- La lectura de carátulas se prueba con un proveedor simulado y un PDF sintético. Antes de usar documentos de clientes, validar una lectura real con la credencial del proveedor configurado. No se enviaron documentos reales a IA en las pruebas de esta entrega.

Las nuevas funciones tienen tarjetas ilustradas, recorridos y una entrada en Novedades. El login se conserva.

## Siguiente corte del diagnóstico: entrega documental y comparativo técnico

- Los documentos existentes y nuevos quedan internos por defecto. En Documentos, **Revisar entrega** permite clasificarlos como carátula o recibo, exclusivamente si están vinculados directamente a una póliza del expediente, con revisión humana del contenido completo. Identificaciones, datos médicos, credenciales, documentos generales y otros archivos no se habilitan por nombre.
- El redactor y el servidor comparten el filtro de adjuntos. Solo permite carátulas/recibos aprobados, activos y del cliente seleccionado; no acepta archivos generales ni de siniestros. El asesor confirma identidad y titularidad/autorización de TODOS los destinatarios y registra una referencia sin datos sensibles en cada envío con adjuntos. Es una verificación humana documentada, no validación biométrica ni una autorización automática por tener un correo registrado.
- La clasificación usa control de versión y queda auditada. Revocar la entrega elimina el archivo de la selección futura; no recupera adjuntos ya entregados por email. No se habilitaron enlaces públicos ni un portal externo de descarga. La descarga interna del equipo conserva sus permisos vigentes.
- Renovaciones incorpora deducible, coaseguro, suma asegurada y cambios relevantes, de captura manual con fuente/página y comparación anterior/nueva en el resumen. Los campos vacíos se muestran como pendientes; no hay deducción automática de coberturas ni aprobación de la aseguradora.
- Drive: Tony confirmó cuentas personales de Gmail; falta recibir las carpetas. No se inicia una migración ni se sustituye R2. Se preparará OAuth individual y selección limitada cuando estén disponibles.
- Pendiente del diagnóstico: alertas configurables y etapas extendidas de renovación; piloto real con Ale/Joel; ampliar trámites más allá de domicilio/RFC MetLife; conciliación real de recibos; integración efectiva de Drive; números reales y agentes supervisados. No se habilita automatización externa por publicar estos controles.
- La migración aditiva `20261029193000_document_delivery` solo añade clasificación, revisión y responsable de revisión a Document. Las pruebas SQL de `brokers:smoke` comprueban selección por póliza/cliente, clasificación, conflictos, revocación y rechazo de envío forzado sin mensajes externos; todas sus muestras se descartan.
