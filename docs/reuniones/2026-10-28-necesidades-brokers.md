# Reunión con brokers: necesidades y orden de implementación

Reunión: 28 de octubre de 2026. Revisión: 29 de octubre de 2026.

Fuente: video local `2026-10-28 16-41-43.mp4`, duración 01:06:22. Se revisó la transcripción automática de todo el audio y una secuencia de capturas del video, ampliando pantallas relevantes. Los minutos son aproximados. Los tramos de transcripción con repeticiones o nombres dudosos no se usaron para definir requisitos. Este documento resume necesidades; no reproduce datos de clientes, credenciales, enlaces de autorización ni transcripciones privadas.

**Estado de esta entrega: análisis y priorización, no funcionalidades publicadas.** El inventario de implementación se contrastó con el código local; no equivale a una prueba en producción de cada módulo. La verificación de Meta continúa pendiente según la captura aportada por Tony.

## Decisiones vigentes

- Tony priorizó configurar brokers y sus bandejas antes de conectar números reales.
- El 29 de octubre confirmó expresamente: **cada broker solo ve su propia bandeja**. Un filtro visual no satisface esta regla; debe aplicarse en las consultas y operaciones del servidor.
- Ale lleva gastos médicos y Vida; Joel, autos (asignación confirmada anteriormente por Tony, no una decisión nueva extraída del video).
- Un cliente puede tener varias pólizas y responsables distintos por póliza. Separar las bandejas no implica duplicar al cliente ni cambiar automáticamente los permisos del resto del CRM.
- La autorización para preparar cambios de Ale y Joel no requiere que Tony confirme sus propuestas. Cada persona sigue revisando y confirmando sus propias operaciones dentro del CRM.
- El MCP vigente trabaja con **datos y archivos del CRM**, según el alcance elegido por Tony. No modifica código, diseño de páginas ni despliegues.

## Necesidades observadas y diferencia frente al estado actual

| ID | Evidencia del video | Necesidad | Estado contrastado con el código | Resultado esperado |
| --- | --- | --- | --- | --- |
| REN-01 | 05:34–07:00 | Comparar la renovación GMM con la póliza anterior: costo anterior/nuevo, variación porcentual y pagos, especialmente mensuales. El tratamiento puede variar por producto. | Hay historial de renovación y avisos, pero la plantilla de renovación no ofrece una comparación de dos vigencias ni un flujo de preparación de esa comparación. | Elegir ambas vigencias y sus documentos, revisar los datos y generar un resumen editable con evidencia y campos pendientes. |
| REN-02 | 08:01–10:17 | El recordatorio llega primero al broker; después de descargar y preparar la nueva póliza/cotización, el broker contacta al cliente. Se menciona avisar al cliente con anticipación y evitar dejarlo hasta los últimos días. | Los avisos ya son internos y el correo al cliente requiere un clic. El resumen diario ya contempla avisos propios. Falta distinguir explícitamente la preparación de la renovación y su propuesta lista para enviar. | Recordatorio interno → preparación → comparación/documentos listos → revisión → envío elegido por el broker. No interpretar las explicaciones de la reunión como autorización de envío automático. |
| REN-03 | 07:31–08:01 | Crear plantillas propias, nombrarlas y configurar cuándo se utilizan con variables fáciles de insertar. | Hay cinco tipos fijos de plantilla, editables por el equipo; no hay catálogo libre de tipos ni periodicidad configurable por plantilla. | Editor con nombre, propósito, variables permitidas, destinatario interno/cliente y anticipación. Definir estos ajustes antes de ampliar la programación. |
| CAP-01 | 10:24–11:43 | Adjuntar la carátula para preparar el alta de una póliza sin recapturar todos sus datos. | El MCP puede proponer altas de pólizas con datos que extraiga el cliente de IA. No hay un lector automático de carátulas integrado en el formulario manual del CRM. | Documento → datos propuestos → selección del cliente existente → revisión de campos y faltantes → confirmación → vínculo del documento con la póliza. |
| CAP-02 | 10:49–11:19 y 40:48–43:40 | Completar un expediente ya iniciado, consultar Drive y vincular varias pólizas de diferentes ramos al mismo cliente. En el ejemplo hay contratante y asegurado diferentes. | Existen expedientes con varias pólizas, edición parcial y propuestas MCP. Tener Drive conectado en ChatGPT no equivale a tener integración nativa de Drive dentro del CRM. | Buscar primero al cliente, verificar identidad y vínculos, completar solo los campos revisados y no crear otro cliente por cada póliza. No confundir contratante, asegurado y contacto. |
| REC-01 | 16:24–17:45 | Reunir links de pago por aseguradora, calculadoras y comparativas en un centro de recursos. | La necesidad incluye el sitio web público y herramientas para el equipo; no se identificó un módulo dedicado que cubra ambas audiencias. | Catálogo con título, categoría, aseguradora, enlace, audiencia y responsable. Separar herramientas internas de enlaces que puedan compartir los clientes. Confirmar qué superficie pública corresponde al sitio comercial antes de publicarla. |
| MCP-01 | 39:09–40:48 y 43:40–57:42 | Consultar y preparar cambios desde su propio ChatGPT; entender por qué algo sigue sin aparecer en el expediente. | El MCP prepara propuestas; no aplica cambios por sí mismo. En la reunión se observa que los datos aparecen tras confirmar y aplicar. El código distingue estados, pero la explicación del flujo resulta insuficiente para el usuario. | Tarjeta inequívoca con «Pendiente de tu revisión», botón de revisión, resultado «Aplicado» e invitación a verificar la ficha. Nunca afirmar «guardado» cuando solo existe una propuesta. |
| MCP-02 | 55:00–55:38 | Completar datos administrativos adicionales, incluido código postal, sin cambiar de herramienta innecesariamente. | La ficha externa del CRM sí admite dirección y código postal. El borrador MCP de ficha admite solo nombre, correo y teléfono; el cliente maestro expuesto por MCP incluye nombre, correo, teléfono y RFC. | Definir explícitamente qué campos adicionales se permiten, su validación y el destino de cada campo. No ampliar de forma indiscriminada el acceso a información sensible. |
| POL-01 | 59:21–62:20 y 63:56–66:22 | Conservar el número de póliza completo, incluido el prefijo/código del producto; corregirlo antes de aplicar el alta. | El número se guarda como texto, pero no existe una regla general de prefijos por aseguradora/producto. Se observó una corrección manual durante la revisión. | Mostrar el valor completo y su origen; conservar ceros, separadores y prefijos. Un código del catálogo solo puede sugerirse si se valida para ese producto; no concatenarlo ni inferirlo siempre. |

El tramo intermedio incluye instalación y permisos del conector, configuración de cuentas y explicaciones sobre modelos. No se convirtió cada explicación técnica de la llamada en un requisito de producto. Los precios o consejos de consumo mencionados allí no se adoptan como especificación vigente.

## Prioridad 1: cuentas de brokers y bandejas privadas

### Brecha actual comprobada

- `WhatsAppConversation` ya distingue contactos por `phoneNumberId + contactId`.
- `src/modules/whatsapp/send.ts` y `connection.ts` usan un solo juego de variables de entorno para número/token/versión.
- Las rutas de conversaciones comprueban el rol del equipo, pero aún no restringen cada conversación al broker dueño del número.
- La documentación `docs/whatsapp-bandeja.md` reconoce que todavía no hay aislamiento por broker.
- La bandeja es de atención humana. Esta etapa no activa respuestas automáticas ni conecta números de clientes por su cuenta.

### Especificación de la siguiente implementación

1. Registrar canales empresariales con nombre, broker responsable, identificador de número de Meta, cuenta empresarial, estado de conexión y referencia a la credencial privada del servidor. No guardar el token en campos visibles ni enviarlo al navegador.
2. Vincular cada conversación al canal correcto usando la identidad verificada del número de Meta. Nunca asignar propietario a partir de un nombre escrito por el contacto o de un parámetro del navegador.
3. Aplicar la regla de propiedad en listado, contadores, búsqueda, lectura del hilo, paginación, respuesta, cierre/reapertura, comprobación de conexión y futuros adjuntos/exportaciones. Cambiar un ID en la URL no debe permitir leer ni responder otra bandeja.
4. Resolver el remitente y la credencial en el servidor a partir del canal autorizado. Mantener idempotencia, límite de respuesta vigente y bloqueo de reenvíos ambiguos ya implementados.
5. El webhook debe seguir recibiendo y conservando eventos firmados de ambos números. Un número desconocido queda pendiente de asociación administrativa, sin hacerlo visible a todos ni atribuirlo automáticamente a Ale o Joel.
6. Conservar el historial actual. Las conversaciones del número de prueba o sin responsable requieren una asignación explícita; no repartirlas por coincidencias de nombres, por el usuario que las consulte primero o por una inferencia de la IA.
7. Ale y Joel no pueden reasignarse canales ajenos ni cambiar sus credenciales. La configuración se administra con el rol apropiado. La eventual supervisión global del superadmin debe quedar explícita y auditada; no se ha confirmado como excepción a la privacidad solicitada.
8. Mostrar el nombre del broker/canal propio y estados honestos: pendiente de Meta, sin credencial, conexión comprobada y error. Poder consultar un número no prueba que Meta permita enviar mensajes.

### Criterios de aceptación

- Con sesiones separadas de Ale y Joel, cada uno ve únicamente los canales y conversaciones autorizados a su identidad.
- Sus contadores, resultados de búsqueda y vistas vacías no revelan contactos ni actividad de la otra bandeja.
- Una petición directa con un ID ajeno no devuelve datos ni permite cerrar o responder la conversación.
- El mismo contacto que escriba a ambos números conserva dos conversaciones independientes y un expediente CRM cuando corresponda, sin duplicar al cliente automáticamente.
- Un callback repetido no duplica mensajes; el envío desde cada canal usa su número y credencial, sin respaldo silencioso al otro broker.
- Las pruebas de aislamiento usan datos simulados o transacciones descartables. Los mensajes a personas reales requieren la acción humana correspondiente.
- El alcance de las consultas de WhatsApp de agentes y futuras herramientas MCP debe respetar estas mismas reglas. Una bandeja privada no puede filtrarse a través de una herramienta más amplia.

### Qué se puede preparar sin aprobación de Meta

Modelo de canales, permisos, UI, estados de configuración, preservación de historial y pruebas de aislamiento. Los números reales y sus credenciales se vinculan posteriormente mediante el flujo autorizado que corresponda; la aprobación de Meta no se da por hecha. No desregistrar los números existentes de WhatsApp Business para avanzar esta etapa.

## Prioridad 2: renovación preparada por el broker

Flujo propuesto, aún no implementado como tal:

**Por preparar → documentación nueva disponible → comparación revisada → lista para comunicar → comunicación registrada.**

- Separar fecha de aviso al broker, fecha de vigencia y fecha de comunicación al cliente.
- Adjuntar carátula anterior, nueva carátula/cotización y recibos del período correcto.
- Comparar importes en la misma moneda y con el mismo concepto. Si falta la prima anterior o es cero, no calcular un porcentaje engañoso. No mezclar prima total y mensualidad.
- Mostrar la diferencia absoluta y porcentual solo con importes revisados. Las coberturas y cambios contractuales requieren evidencia documental; no deducirlos del precio.
- Conservar ambas vigencias y el historial: una renovación no sobrescribe la póliza anterior ni marca recibos pagados.
- Mantener el envío al cliente sujeto a revisión del broker. Correo disponible primero; WhatsApp sujeto a permisos, ventana y plantillas aprobadas cuando apliquen.

## Prioridad 3: captura asistida desde documentos y mejor revisión

- Unificar el vocabulario de propuesta, revisión y aplicación entre ChatGPT y el CRM.
- Añadir extracción de carátulas a la captura manual cuando haya un servicio configurado; mostrar cada dato extraído con su origen, faltantes y posibles ambigüedades.
- Priorizar número completo, aseguradora, producto, contratante/cliente, vigencia, moneda, prima y periodicidad. Las mensualidades se toman de recibos o de datos revisados; no se inventa un calendario contractual a partir de una división simple.
- Revisar y evitar duplicados por cliente/póliza antes de proponer altas; completar un expediente existente mediante edición parcial.
- Ampliar de forma acotada los campos administrativos del borrador de ficha, incluida dirección/código postal si se confirma su uso, manteniendo consentimientos y revisión humana.
- Añadir tutorial de la nueva función y entrada de novedades cuando se implemente; este análisis por sí solo no debe aparecer como una función ya disponible.

## Prioridad 4: recursos y plantillas personalizadas

- Separar recursos internos (calculadoras y herramientas del equipo) de enlaces para clientes (portales de pago y recursos aprobados).
- Configurar el catálogo y la publicación pública como dos alcances distintos. No publicar herramientas internas por defecto.
- Crear plantillas propias con variables permitidas y vista previa; distinguir destinatario interno de cliente.
- Mantener los enlaces de pago como enlaces aprobados, sin capturar tarjetas ni suponer que una visita confirma un pago.

## Dependencias y asuntos abiertos

- Meta: la captura del 29 de octubre sigue mostrando «En revisión» y no solicita documentación adicional. Configuración local y pruebas pueden avanzar; activación real depende de los permisos correspondientes.
- MCP Android: el bucle de reconexión reportado el 29 de octubre continúa sin una reproducción completa en el dispositivo de prueba; no declararlo solucionado por haber funcionado el escritorio en la reunión.
- Confirmar los dos números empresariales y el control de cada cuenta antes de asociarlos a canales reales. No incluir tokens en este documento.
- Confirmar una posible supervisión del superadmin y cualquier mecanismo de suplencia entre brokers antes de crear excepciones al aislamiento.
- Pedir los enlaces y herramientas definitivos del centro de recursos y su audiencia.
- Validar con documentos los prefijos por producto; la conversación no basta para codificar una regla universal.

## Referencias de implementación consultadas

- `prisma/schema.prisma`: WhatsAppConversation, WhatsAppMessage, WhatsAppReceipt, pólizas y expediente.
- `src/app/api/whatsapp/conversations/` y `src/components/whatsapp-inbox.tsx`: bandeja vigente.
- `src/modules/whatsapp/{server,send,connection,parse}.ts`: recepción, envío y conexión.
- `src/modules/email/{template-text,notices-server,digest-server}.ts`: plantillas, avisos internos y resumen del broker.
- `src/modules/polizas/{finance,finance-server}.ts`: renovación e historial financiero.
- `src/modules/clientes/dossier-policy.ts`: alta de póliza y calendario de recibos.
- `src/modules/mcp/{policy,data,forms}.ts` y `src/modules/intake/schema.ts`: campos disponibles, propuestas y fichas.
- `docs/whatsapp-bandeja.md`, `docs/conexion-mcp.md`, `docs/correo-resend.md`: alcance documentado de las integraciones.

No se alteraron clientes, pólizas, credenciales ni conexiones reales para elaborar este análisis. La transcripción y las capturas de trabajo permanecen locales, fuera del repositorio.
