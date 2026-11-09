# Búsqueda unificada de Sistema AJ

Fecha: 9 de noviembre de 2026.

## Comportamiento

La comparación del CRM tolera mayúsculas, acentos, comas, espacios repetidos, guiones, puntos y barras. Las palabras pueden escribirse en distinto orden o combinar datos relacionados, como apellido y número de póliza. Los identificadores se comparan como texto: se conservan ceros iniciales y no se adivinan números ni se fusionan registros.

El expediente también se encuentra por el número de cualquiera de sus pólizas no archivadas. El formato almacenado no cambia.

## Cobertura revisada

| Entrada | Datos y destino |
| --- | --- |
| Listados y selectores del CRM | Prospectos, clientes, pólizas, cotizaciones, pagos, renovaciones, siniestros, actividades y productos; aseguradoras dependientes del catálogo |
| Expedientes | Nombre, ID, RFC, correo, teléfono y pólizas relacionadas |
| Documentos | Nombres de archivos y carpetas, cliente o póliza, conservando la carpeta y expediente abiertos |
| WhatsApp | Nombre y teléfono, conservando la bandeja propia y el alias mexicano histórico solo para consulta |
| Buscador global | Los nueve recursos anteriores, archivos, carpetas, aseguradoras, entregas, recursos, trámites, avisos pendientes, eventos registrados en AJ, conversaciones propias, plantillas propias y usuarios según rol |
| Accesos globales | Las secciones actuales, incluida agenda, importación, conexiones, novedades y registro de actividad, con mínimos de rol |
| MCP y herramientas de los asistentes | La misma comparación para localizar registros; no amplía permisos ni ejecuta cambios |
| Otras búsquedas locales | Recursos, novedades, guías y perfiles del catálogo |
| Registro de actividad | Misma comparación, conservando retención y exclusión de eventos privados de WhatsApp |
| Google Drive | Se limpian separadores de la consulta al proveedor y se aplica la misma comparación al nombre de sus resultados |

Drive mantiene su índice nativo y la carpeta abierta como límite. No se descargan documentos, no se crea un índice recursivo de Drive ni se leen archivos privados desde el buscador global. La agenda global busca eventos de AJ, no todo el contenido remoto de Google Calendar. La navegación administrativa se encuentra por sección; el buscador no inspecciona archivos importados ni historiales internos completos.

## Implementación y controles

- `src/modules/smart-search.ts`: comparación compartida por los filtros del navegador.
- `src/modules/smart-search-server.ts`: fuentes de búsqueda de PostgreSQL; consulta parametrizada de IDs candidatos. Las columnas y tablas proceden de una lista fija del servidor.
- Migración `20261109180000_smart_search`: funciones SQL de normalización, sin extensiones adicionales ni cambios a los registros.
- El listado final sigue aplicando sus filtros de estado, archivo, responsable, carpeta, paginación y proyección de campos.
- Agenda, WhatsApp y plantillas conservan el usuario o canal propietario. Usuarios y accesos solo aparecen para superadmin; trámites y avisos conservan sus controles de rol.
- Las notas internas buscables de los módulos privados se conservan para el CRM. El MCP no busca narrativas médicas, notas de renovación ni descripciones privadas de actividades; tampoco busca referencias bancarias.
- La consulta vacía conserva el listado habitual. Una consulta compuesta solo por símbolos no se interpreta como un comodín para todos los registros.
- Consultar resultados no selecciona, vincula ni modifica automáticamente una póliza.

## Verificación

1. Pruebas de normalización: acentos, comas, orden de palabras, separadores numéricos, espacios, símbolos y preservación de ceros.
2. Pruebas del servidor: parámetros SQL, exclusión de notas en MCP y controles de bandeja, agenda, plantillas, trámites y accesos según rol.
3. Prueba de integración con PostgreSQL: consultas de todas las fuentes y registros ficticios dentro de una transacción revertida. Verifica estado y expediente por póliza.
4. Caso real reportado: se comprobó en lectura el cliente y póliza de referencia con cuatro variantes, incluida búsqueda sin comas y número con separadores. El controlador global respondió 200 y devolvió ambos registros; sin escrituras. La consulta global tardó aproximadamente 1.9 segundos desde el entorno local en esa prueba.
5. Navegador con respuestas de prueba: consulta desde el campo, agrupación, navegación con teclado al registro correcto, icono de Calendar, cierre, ancho móvil y apertura directa del hilo de WhatsApp.
6. Comprobación completa del proyecto: esquema, lint, tipos, pruebas y compilación. Existe una advertencia previa sobre la etiqueta de imagen de las miniaturas de Drive.

El volumen actual permite comparar en la base antes de paginar. Si crece sustancialmente, evaluar índices normalizados por entidad y medir latencias de nuevo; no truncar silenciosamente candidatos antes de aplicar permisos o contar resultados.

## Mantenimiento

Al agregar una entidad, registrar sus campos seguros en el módulo del servidor, incorporar proyección y permisos en el buscador global y revisar las pruebas de cobertura. Aplicar migraciones antes del nuevo código; el despliegue de Vercel ya sigue ese orden.
