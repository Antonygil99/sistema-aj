# Atención asistida de WhatsApp

31 de octubre de 2026. Primera fase del plan de agentes para las bandejas privadas. **No activa agentes autónomos ni depende de la aprobación de Meta.**

## Entrega actual

- WhatsApp → Probar clasificación: ocho casos ficticios (ventas, renovación, pago con imagen, urgencia, cambio de domicilio, audio, varios motivos y falta de contexto). Funciona sin proveedor de IA ni número real. No persiste los ejemplos ni llama a Meta.
- En un hilo propio, el servidor orienta el último mensaje **entrante** completo disponible en la base, independientemente de la página de historial o de una respuesta posterior del broker.
- Motivos: ventas/cotización, renovaciones, pagos, siniestros, administración y coordinador. Conserva varios motivos cuando los detecta. Los ramos y la prioridad son sugerencias, no datos confirmados de un expediente.
- Posibles urgencias se priorizan para atención humana. Audio, imagen, video, documento y otros mensajes no textuales requieren revisión manual. Solo se considera el texto/caption guardado; no se descargan ni analizan archivos.
- El borrador es una sugerencia estática revisable, sin detalles extraídos de la cartera ni transcripciones. No ejecuta prompts, herramientas o enlaces contenidos en los mensajes. No interpreta cobertura, pago aplicado, firma, estado médico o identidad.
- Llevar al redactor requiere un canal listo para responder, ventana abierta, ausencia de envío ambiguo y redactor vacío. No sobrescribe un texto existente ni envía. La persona revisa y pulsa el envío habitual, conservando permisos, aislamiento, ventana e idempotencia del servidor.
- La bandeja y toda su orientación permanecen con el propietario del canal. Mencionar Autos/Vida/GMM **no transfiere la conversación** a otro broker. Confirmar identidad, póliza y autorización precede cualquier consulta/entrega al cliente.
- Lectura autenticada, sin caché y posterior a la comprobación de canal propio. El token interno y el superadmin sin canal propio no obtienen conversaciones ajenas. El motor puro es `src/modules/whatsapp/assistance.ts`; el UI está en `src/components/whatsapp-assistance.tsx`.
- Reglas `RULES_V1`, sin coste de IA ni escritura adicional. La bandeja identifica explícitamente que todavía no ejecuta IA. Hay tarjeta ilustrada, recorrido y Novedades. Sin migraciones de base de datos.

## Límites que hay que conservar

Es una clasificación por palabras, no comprensión semántica ni detección garantizada de urgencias. Puede equivocarse, especialmente con negaciones, referencias previas, cambios de tema o contenido solo multimedia. La persona debe leer cada mensaje. Los ejemplos no acreditan respuestas reales ni conexión de números de brokers.

## Siguientes fases de los agentes

1. **Coordinador / Método AJ:** acordar con Ale guiones, mínimos de captura, horarios, umbrales y derivaciones. Vincular solicitudes a la póliza tras identificación, sin asumir titularidad por teléfono. Mantener cartera y bandeja como ámbitos distintos.
2. **Ventas:** revisar coincidencias, proponer prospecto y ficha externa individual reutilizando sus controles. Confirmar antes de crear; no duplicar por cada mensaje.
3. **Renovación y pagos:** contextualizar por póliza/recibo verificados, preparar comparativo y revisión previa a comunicación. Confirmar pago solo con el proceso de revisión humana existente, nunca por recepción de una imagen.
4. **Siniestros y administración:** orientar según compañía/producto, preparar tareas y trámite disponible; escalar cobertura y urgencias. No solicitar capturas bancarias, historias clínicas o firmas por la ficha administrativa.
5. **Proveedor IA supervisado:** clave privada/modelo válido, límites de uso y costes, herramientas con identidad humana/alcance de canal, propuestas revisables e historial de decisiones. Reutilizar el runtime existente; no ampliar sus herramientas generales a los brokers sin revisar el ámbito de cada consulta.
6. **Multimedia:** descarga privada autorizada, límites/retención, transcripción/extracción consentida y separación de datos sensibles antes de habilitar lectura. No confundir recibir el evento con tener acceso al archivo.
7. **Acciones:** enlace revisado con expediente, creación idempotente de tareas/prospectos y preparación de formularios. No están conectadas al clasificador actual; hoy solo sugiere el siguiente paso.
8. **Piloto real:** números y permisos Meta, elegibilidad de coexistencia, token y ventanas, pruebas independientes con Ale/Joel; atención humana y estado de entrega. La revisión de negocio de Meta continúa como dependencia externa.

## Verificación

- Tests del motor: ramos, varios motivos, urgencias, revisión sensible, multimedia y resistencia a instrucciones insertadas.
- `brokers:smoke`: SQL y sesiones efímeras dentro de una transacción revertida; hilo propio, denegación del ajeno, último entrante pese a respuesta saliente/paginación y lectura sin enviar/persistir borradores. Las muestras se descartan.
- UI: componentes reales con API simulada, borrador sin sobrescritura, ausencia de envío al colocar borrador, casos de prueba, teclado, modal, escritorio y móvil. No sustituye el piloto con mensajes reales.
