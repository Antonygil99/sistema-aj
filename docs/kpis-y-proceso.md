# KPIs y necesidades operativas de AJ

Se añadieron cuatro indicadores a cada uno de los once módulos del catálogo del CRM. Son consultas de registros reales y excluyen registros archivados. Los indicadores abarcan todo el equipo, independientemente de búsqueda, vista, paginación y filtros del listado. En Documentos, al abrir un cliente, abarcan todo su expediente y sus carpetas. Cada tarjeta explica su fórmula en “Cómo se calculan” y muestra la hora de consulta.

| Módulo | Indicadores |
| --- | --- |
| Prospectos | Seguimiento abierto, etapa emisión, convertidos con expediente, conversión acumulada |
| Clientes | Expedientes, clientes con cobertura vigente, clientes sin contacto, clientes que recomiendan |
| Productos | Catálogo, productos con pólizas vigentes, sin responsable, fichas por completar |
| Pólizas | Pólizas y prima total registrada, cobertura vigente, vencimientos a 60 días, prima de cartera vigente |
| Entregas | Pólizas del tablero, sin entregar, proporción con checklist completo y entrega, seguimientos 7/30/90 vencidos |
| Cotizaciones | En preparación/enviadas, aceptadas, aceptación entre decididas, propuestas vencidas |
| Pagos | Recibos por confirmar este mes, importe vencido, cobrado en el mes, pólizas sin recibos |
| Renovaciones | Pólizas por vencer a 60 días, gestiones pendientes, proporción renovada entre resueltas, pólizas próximas sin gestión |
| Siniestros | Casos abiertos, en revisión, cerrados, abiertos desde hace al menos 30 días |
| Documentos | Archivos privados, carpetas existentes, archivos cargados en el mes, archivos generales |
| Actividades | Pendientes, vencidas, para hoy, completadas acumuladas |

Las primas y los cobros se suman por moneda, sin mezclar MXN, USD u otras divisas. Prima de cartera no significa ingreso recibido ni comisión. Una tasa sin denominador se muestra como `—`. Una serie monetaria sin datos se muestra como “Sin registros”. En Pagos se alerta explícitamente si hay pólizas sin calendario conciliado; un radar vacío no certifica ausencia de deuda. Las fechas del mes operativo se determinan en Ciudad de México; las fechas de recibos guardadas a medianoche UTC se tratan como días calendario para incluir el primer día del mes.

Los KPIs se consultan desde el servidor con sesión. `/api/metrics/[module]` y `/api/metrics/radar` exigen autenticación y responden sin caché. Se actualizan tras cambios de registros, subidas y eventos del equipo, al volver a enfocar la ventana o usando el botón de actualizar, sin reiniciar formularios. Si falla una consulta, se conserva el último resultado y se muestra el error.

## Proceso descrito en los audios del cliente

El 13 de octubre de 2026 Tony compartió dos notas de voz. Se transcribieron localmente; los audios y las transcripciones completas se mantienen fuera del repositorio público. El siguiente resumen recoge necesidades de negocio, no autoriza envíos a terceros ni ejecución de macros.

- Resumen de cartera y suma de primas (audio 12:39:42, 01:05).
- Radar de pólizas que vencen en los próximos **60 días**, preferentemente en una ventana con espacio para revisar todo el listado (01:20).
- Al renovar, registrar nuevo número y nueva vigencia, conservando trazabilidad del contrato anterior (02:01). El cliente pide actualizar; preservar historia es la recomendación de implementación, no una afirmación de que ese historial ya exista.
- Calendario dentro del CRM; Google Calendar es opcional. Recordatorios de renovación a **30, 20 y 10 días** (02:21).
- Confirmar el recibo concreto de una póliza fraccionada para que deje de aparecer pendiente sin perder los siguientes vencimientos (03:47).
- Radar de pagos del mes y posibles avisos a **20 días, 10 días y el día de vencimiento**, por correo o WhatsApp (04:27).
- Unir la fuente de promotoría, que repite una póliza por cada recibo, con la fuente CRM, que tiene una fila por póliza y añade contactos y vehículo (segundo audio, 00:09–01:38). Su prioridad es evitar que se pase alguna póliza o fecha de pago (02:02).

## Implementado en esta entrega

KPIs en los once módulos, total de prima registrada y prima vigente separadas, radar de renovación a 60 días y radar de recibos del mes accesibles desde tarjetas mediante ventanas paginadas. La ventana de pagos enlaza al recibo real para que un administrador pueda confirmarlo con el editor existente. Al guardar como PAID y registrar paidAt deja de formar parte del radar pendiente.

La estructura correcta ya existe: **un cliente → varias pólizas → varios recibos por póliza**, con contactos y documentos en el expediente. No duplicar pólizas al importar doce recibos; cada recibo conserva su propio vencimiento y estado. No marcar pagos como recibidos ni emitir recordatorios automáticos con los importes de origen aún sin conciliar.

## Pendiente para completar el proceso

1. Conciliar el consolidado de recibos contra las pólizas importadas y revisar los casos ambiguos; conservar referencia de recibo, evidencia y fecha efectiva de pago.
2. Flujo de renovación que cree o enlace la nueva vigencia sin sobrescribir ni renumerar el contrato anterior para eludir su unicidad.
3. Agenda interna para vencimientos y seguimientos; conexión adicional y explícita a Google Calendar si el equipo la necesita.
4. Resend y WhatsApp, remitentes/plantillas aprobados, cola idempotente, estado de entrega y prevención de avisos repetidos. Ventanas 30/20/10 y 20/10/0 a validar con el equipo al activar envíos.
5. Automatización de agentes después de conciliar la información y habilitar proveedor/modelo. Los audios no aportan reglas para determinar cobertura, indemnizar o ejecutar cobros autónomamente.

El resumen principal conserva sus ventanas ya existentes de 30 días, etiquetadas como tales; los nuevos radares operativos de renovaciones trabajan a 60 días, según la necesidad expresada. No se ejecutaron macros de los archivos ni se expusieron audios, contactos o pólizas en Git.

Validación: pruebas de fronteras de mes, divisas separadas y tasas sin denominador; `npm run check`; prueba de integración de solo lectura con `npx tsx scripts/metrics-smoke.ts` contra la base configurada tras compilar. Esa prueba no crea ni modifica registros de negocio o sesiones de usuarios.
