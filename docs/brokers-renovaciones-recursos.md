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

## Continuación: etapas, próxima actividad e historial de renovación

- Etapas: Por preparar → Solicitada a la aseguradora → Propuesta recibida → Revisada y lista → Comunicación realizada → Seguimiento. También puede cerrarse como No renovada, con motivo, sin cancelar la póliza ni tocar recibos. Se permite preparar una propuesta ya disponible sin inventar una solicitud previa.
- Solicitada exige referencia de solicitud REAL y próxima fecha; recibida exige documento. Comunicación exige una propuesta previamente lista y referencia del medio utilizado. Seguimiento exige fecha y comunicación previa. Editar condiciones ya revisadas exige volver a Por preparar antes de validarlas otra vez.
- Se reutiliza una sola Activity `RENOVACION_<policyId>`, asignada al responsable de la póliza (o al asesor que inicia si no tiene responsable). Reprogramar actualiza esa actividad; no crea duplicados. Cerrar sin renovación la completa; reabrir conserva historial y reactiva el seguimiento si tiene fecha.
- Al registrar una nueva vigencia mediante el flujo financiero existente se marca Nueva vigencia registrada y se completa la tarea en la misma transacción. No se permite marcar ese resultado manualmente ni reabrir la preparación de una vigencia ya renovada. No se inventan recibos ni se confirman cobros.
- El historial registra actor, fecha y transiciones dentro de la misma transacción, y se consulta desde la preparación. La campana y el resumen diario existentes incluyen la tarea; el resumen enlaza a pólizas para renovación y a actividades para otros trámites. No se añadió un segundo programador ni un envío automático al cliente.
- Verificación SQL adicional: transiciones, revisión caducada al cambiar datos, una sola tarea tras reprogramar, cierre sin cancelar cobertura y cierre al crear nueva vigencia, con rollback de todas las muestras. Navegador con componentes reales y API simulada en escritorio y móvil.
- Siguen pendientes las alertas configurables 60/45/30, el piloto con carátulas reales, ampliar trámites y vincular Drive cuando lleguen las carpetas de Gmail personal.

## Drive: referencias privadas y autorización individual

- Acceso desde Conexiones → Configurar Google Drive, o desde el expediente → Referencias de Google Drive. No añade otra opción al menú esencial. Ale y Joel comparten una raíz, pero cada uno autoriza su cuenta de Gmail y Google comprueba sus permisos.
- La carpeta proporcionada por Tony se prepara en la base privada para ambas cuentas, desactivada hasta su consentimiento. Ni su URL, ID o resource key reales se incluyen en Git. No basta con tener el enlace ni con iniciar sesión en AJ.
- Habilitar Google Drive API en el mismo proyecto OAuth existente. El callback utiliza el mismo enlace social de Better Auth y verifica nonce de un solo uso, usuario y caducidad. Tokens cifrados en AuthAccount; no hay otra copia, ni tokens en navegador. La conexión no cambia el login ni revoca Google Calendar.
- Alcance inicial: `drive.metadata.readonly`. Google lo describe como acceso a metadatos de Drive; no como permiso limitado a una carpeta. La aplicación restringe sus consultas a la raíz seleccionada y sus descendientes. Puede requerir configurar Data Access / usuarios de prueba o verificación de Google según el estado de la aplicación. No ampliar silenciosamente a `drive.readonly`, `drive` o descarga de contenido.
- Cada acceso comprueba metadatos y ascendencia bajo la raíz: no recorre accesos directos, papelera, ciclos o archivos ajenos. API limitada a hosts Google fijos, tiempos de espera y caché por solicitud. Resource keys se envían por el encabezado oficial, sin copiarlos a auditoría.
- Explorar: hasta 50 elementos por página. Vincular crea una referencia compartida de equipo por cliente/archivo; no copia archivos a R2, analiza contenido, genera permisos públicos ni autoriza entregas a clientes. Solo ADMIN/SUPERADMIN con sesión humana pueden operar; la integración sin identidad no accede.
- Consultar referencias: hasta 20 recientes, revalidadas contra la cuenta actual y la raíz vigente. Abrir vuelve a verificar Google y redirige al archivo/carpeta en Drive. La sesión de Google del navegador sigue determinando el acceso al original. Desvincular elimina solo la referencia compartida, nunca el archivo original.
- Desconectar desactiva Drive para esa cuenta del CRM; no revoca la concesión Google completa porque podría afectar Calendar. El usuario puede retirarla adicionalmente desde Seguridad de su cuenta Google. Cambiar la raíz conserva las referencias anteriores pero no las muestra bajo otra raíz.
- No hay descarga, indexación de contenido, OCR, sincronización masiva ni herramientas Drive para agentes/MCP en esta etapa. No se afirma haber leído los archivos reales hasta que cada broker autorice y pruebe su cuenta.
- Migración aditiva `20261029213000_drive_references`: DriveConnection y ClientDriveLink. Control por usuario, vínculo cliente/archivo único y referencia al cliente con borrado restringido.
- Pruebas: árbol de metadatos simulado con rechazo de enlaces ajenos, atajos y papelera; SQL y sesiones descartables para aislamiento de configuración, callback sin autorización, desconexión propia y denegación previa a llamadas al proveedor. Ninguna muestra cambia permisos reales de Drive.

## Anticipación personal de renovaciones

Preferencias → Notificaciones permite configurar de uno a cinco umbrales únicos entre 1 y 180 días, por defecto 60/45/30. Se guardan por cuenta. El resumen diario existente incluye las pólizas asignadas dentro de esa anticipación, indicando el umbral actual, y las conserva visibles mientras requieren preparación. No son cinco correos distintos ni un nuevo cron. Requiere activar el resumen por correo y configuración existente de Resend; no altera los avisos manuales al cliente ni comunica una renovación sin revisión. No incluye pólizas archivadas, canceladas, con nueva vigencia o preparación cerrada.

Sigue pendiente: prueba con Google real tras habilitar API/consentimiento, piloto de renovación con documentos reales y ampliación de trámites por aseguradora con requisitos y formatos aprobados. La conexión de Drive en ChatGPT no se hereda como permiso de los agentes del CRM.

### Fuentes de Drive en el comparativo

La preparación de renovación ofrece, junto a R2, las referencias PDF/imagen del mismo expediente que puede consultar el asesor bajo su conexión de Drive. Abrir el original se vuelve a validar con Google. Guardar una preparación con esas fuentes exige sesión humana, autorización Drive vigente, raíz y ascendencia verificadas, coincidencia de cliente y referencia existente; una cadena `drive:ID` enviada por sí sola no concede acceso. Los metadatos se validan antes de la transacción y la raíz, conexión y referencia se vuelven a comprobar bajo bloqueo al guardar. No se copia el documento a R2 ni se descarga su contenido para el comparativo manual. No se permite desvincular una referencia usada como fuente de preparación. Esta ampliación no convierte esa referencia en un adjunto autorizable al cliente.
