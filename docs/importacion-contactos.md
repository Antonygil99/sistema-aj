# Importación revisada de contactos y fichas desde el chat

Actualizado: 28 de octubre de 2026.

## Importar desde el CRM

Abre **Prospectos → Importar contactos**, **Clientes → Importar contactos**, o `/importaciones`. Disponible para Administrador y Superadmin. No añade otra opción a la barra lateral.

1. Arrastra un archivo `.xlsx`, `.csv` o `.tsv`, de hasta **4 MiB**. El procesamiento se hace en el servidor, con sesión autorizada. La lectura inicial no crea contactos ni conserva el archivo original en R2.
2. Elige una hoja y si quieres guardar prospectos o clientes. Relaciona las columnas de nombre completo, correo, teléfono y RFC (clientes) u origen (prospectos). Las columnas no elegidas no se incorporan al lote.
3. Para números locales de diez dígitos, decide expresamente si corresponden a México (+52). Los demás deben tener lada internacional. Revisa teléfonos numéricos de Excel: ceros iniciales o cifras ya redondeadas no pueden recuperarse automáticamente.
4. Prepara la revisión. Admite **500 filas por lote**, hasta diez lotes pendientes por persona. El lote vence después de **24 horas**.
5. Comprueba las filas nuevas, las coincidencias y los errores. Puedes corregir cada fila. Se comparan nombre normalizado, correo, teléfono y RFC contra clientes, prospectos, archivados y filas del mismo lote. Un nombre igual se puede declarar homónimo tras revisión humana; correo, teléfono o RFC coincidente siguen bloqueados. No se fusionan ni actualizan registros existentes.
6. Selecciona las filas nuevas y marca que comparaste la información con su fuente. Confirma **Importar contactos**. El servidor vuelve a comprobar las coincidencias dentro de la transacción; un cambio concurrente detiene el lote completo para revisarlo de nuevo.
7. Descarga el reporte CSV: altas, identificadores, errores, coincidencias y filas omitidas. Las celdas se escapan para impedir que el reporte ejecute fórmulas en una hoja de cálculo.

Los prospectos empiezan en **Curioso**, asignados al correo de quien confirma. Los clientes reciben su expediente con las carpetas Identificación, Pólizas, Pagos y Siniestros. La importación no crea pólizas, primas, recibos ni movimientos financieros, ni acredita consentimiento del cliente. Tampoco envía mensajes.

Los archivos protegidos con contraseña o macros y los libros demasiado complejos se rechazan. El lector limita expansión ZIP, hojas, columnas, celdas y texto. Las fórmulas no se ejecutan: solo se leen sus valores guardados. Si un libro contiene hojas extensas ajenas a los contactos, exporta únicamente la hoja necesaria como CSV.

## Desde ChatGPT o Claude conectados al MCP

La cuenta debe tener rol Administrador/Superadmin y haber autorizado `crm:write`. La conexión es personal; un lote solo puede revisarlo su propietario. La revocación cancela sus lotes pendientes.

Ejemplos de solicitudes:

- «Extrae de este Excel los prospectos, relaciona nombre, correo y teléfono y prepara la revisión en AJ. Son teléfonos de México. No inventes datos.»
- «De esta imagen/PDF, extrae solo contactos; señala los campos dudosos y la página/fila de origen. Prepara su importación como clientes y muéstrame las coincidencias.»
- «Comprueba el estado del lote que preparaste y dime qué registros se crearon.»

`aj_prepare_import` acepta filas estructuradas con `sourceRef` y `uncertainFields`, o un Excel/CSV en base64 canónico de hasta **1 MiB**, si el chat realmente puede proporcionar el adjunto a sus herramientas. Para libros con varias hojas pide elegir una antes de preparar. No descarga URLs arbitrarias. Si el chat no puede transferir el adjunto, súbelo directamente al CRM.

**La lectura de imágenes/PDF depende del chat que los recibe. El servidor MCP no incluye un motor OCR ni un analizador PDF.** Contrasta siempre los datos extraídos con el original. Solo se admiten campos administrativos de contacto; no información clínica ni bancaria.

La herramienta devuelve un resumen y un enlace de revisión, sin aplicar altas. `aj_import_status` consulta el mismo lote con paginación (`skip`, `take` hasta 25) y devuelve los identificadores de registros creados. No existe herramienta de confirmación automática.

## Formulario individual del cliente

Después de crear o localizar un cliente, puedes pedir:

- «Prepara el formulario externo para que este cliente complete su ficha.»
- «Prepara un borrador de su ficha con este nombre, correo y teléfono confirmados.»
- «Revisa el estado de su ficha y qué datos básicos faltan.»

`aj_prepare_intake` prepara una propuesta (`share` o `draft`). Respeta las restricciones de asesor responsable de la ficha. La persona abre la revisión en **Conexiones**, verifica el cliente y confirma dentro del CRM.

Al confirmar un enlace se muestran, únicamente en esa respuesta del CRM, el enlace privado y un **PIN de ocho dígitos**, con vigencia de **siete días**. Copia el mensaje antes de salir; no se entrega al modelo ni se guarda en el texto de la propuesta. Regenerarlo invalida el enlace anterior. El botón de copiar no envía WhatsApp.

Un borrador no confirma la autorización ni la información en nombre del cliente y no sustituye sus datos principales. El envío externo sigue el proceso existente de revisión y aprobación del asesor antes de trasladar campos al expediente. `aj_intake_status` devuelve estado y campos administrativos faltantes, sin respuestas, PIN ni enlaces secretos. Los formatos de trámites de aseguradoras conservan su flujo específico; esta herramienta prepara la ficha general del cliente.

## Implementación y comprobaciones

- Validación, lector limitado y detección de coincidencias: `src/modules/imports/`.
- API de sesión humana: `/api/imports/parse`, `/api/imports`, `/api/imports/[id]` y `/report`. Rechaza confirmaciones con un token del asistente y cambios desde otro origen.
- Pantallas: `/importaciones` y `/importaciones/[id]`; tarjetas ilustradas, Novedades y recorridos de ayuda.
- Formularios MCP: `src/modules/mcp/forms.ts`; reutiliza `src/modules/intake/server.ts` dentro de la transacción de la propuesta.
- Migración aditiva `20261028173000_reviewed_contact_imports`: `CrmImport` y `CrmImportRow`. No reemplaza datos existentes. Se aplica con `npm run db:deploy`.
- La limpieza existente elimina lotes no aplicados siete días después del vencimiento y reportes aplicados pasados treinta días. No borra los contactos creados ni sus auditorías; no promete una eliminación al segundo exacto.
- Ejecutar `npm run check` y `npm run mcp:smoke`. La prueba integrada revierte todos sus datos y simula almacenamiento. Aísla su juego de claves de firma para no leer claves privadas de producción con un secreto de prueba.

Fuera del alcance: fusión automática, importación de pólizas/pagos, reconocimiento OCR propio, mensajes externos y cambios sin revisión humana.
