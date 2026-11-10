# Operación: expedientes, recibos y renovaciones

Entrega del 9 de noviembre de 2026. Continúa los puntos 1–5 de la auditoría de conexiones entre módulos. El desarrollo y sus pruebas no dependen de la verificación de Meta.

## Por revisar

Página `/revision`, disponible para administradores y superadmin desde Más y el buscador global. El API `/api/review` exige ADMIN y responde sin caché. La cola es de lectura; las correcciones se hacen en los editores y expedientes existentes con sus permisos y versiones.

Contadores por categoría, clic para filtrar, búsqueda compartida sin comas/acentos, paginación real de 20 registros y acceso al registro correspondiente. Las categorías pueden coincidir en una misma póliza; el total de registros es distinto de sumar contadores.

Consulta de producción de solo lectura durante la entrega:

| Pendiente | Registros |
| --- | ---: |
| Pólizas activas sin producto activo vinculado | 5 |
| Pólizas activas sin administrador responsable válido | 2 |
| Productos activos sin administrador responsable válido | 9 |
| Pólizas activas con calendario ausente o por conciliar | 303 |
| Pólizas con seguimiento Renovada sin siguiente vigencia | 1 |
| Registros únicos en la cola | 315 |

Se compara contra accesos habilitados de rol ADMIN o SUPERADMIN. El calendario se considera pendiente si falta, carece de periodicidad, supera 120 recibos, no suma la prima, usa otra moneda, tiene fechas repetidas/fuera de vigencia o conserva la marca de revisión pendiente. Las comparaciones de fechas usan días de calendario, no horas. Una ausencia de recibos no se interpreta como pago, adeudo cero ni estado de cobertura.

Estos pendientes requieren documentación y revisión de los brokers. La entrega no asigna productos o responsables por inferencia y no genera calendarios para la cartera importada.

## Calendario completo

Desde el expediente → Recibos, pagos y renovación:

- Preparar calendario cuando no hay recibos; Ajustar calendario completo cuando existen.
- Edición de fechas e importes de pendientes, altas y retirada de recibos en una propuesta completa. La generación de propuestas avisa antes de reemplazar el borrador. Pago único produce un solo recibo.
- Los pagos confirmados se muestran bloqueados. El servidor exige conservar sus IDs, importe y vencimiento; no vuelve a escribir sus referencias, evidencias ni fechas efectivas.
- Los pendientes retirados se archivan. Su historial permanece; los nuevos recibos quedan sin confirmar.
- Se exige prima total exacta, moneda contractual, vencimientos distintos y ordenados dentro de vigencia, periodicidad y confirmación de revisión documental.
- UDI continúa con revisión separada; no se convierte a MXN ni se habilita generación automática de su calendario.

`PATCH /api/policies/[id]/schedule` usa versión de póliza y una huella de IDs/versiones de todos los recibos activos. Si se confirmó, editó, agregó o retiró uno después de abrir el borrador, se rechaza con RECORD_CHANGED. Todo el ajuste se ejecuta bajo un bloqueo de póliza y una transacción.

El alta inicial sigue usando POST. Si todos los recibos anteriores se archivaron, el editor usa PATCH y conserva ese historial. Archivar o eliminar un pendiente marca el calendario para revisión; los confirmados no se pueden archivar, eliminar ni editar por el CRUD general.

## Reglas compartidas y responsables

El CRUD de pagos permite editar un recibo pendiente solo si el calendario resultante continúa siendo válido. Las altas se preparan como calendarios completos desde el expediente. Cambiar moneda, prima, periodicidad o vigencia de una póliza con recibos también valida el calendario resultante. Las pólizas con recibos o historial de vigencias conservan su cliente original.

Una reasignación de broker actualiza, en la misma transacción, únicamente las actividades automáticas pendientes de entrega 7/30/90, renovación y trámites de esa póliza. Las actividades manuales, terminadas y archivadas conservan su responsable. Los cambios de dueño se validan contra administradores activos. Los calendarios de Google mantienen su sincronización existente al abrir Mi agenda y en el cron diario; esta entrega no escribe en cuentas reales de Google durante las pruebas.

Los bloqueos siguen el orden póliza → recibo o trámite. MCP adquiere el bloqueo de póliza antes del registro financiero. La confirmación de pago, la edición individual y el ajuste de calendario comparten ese orden.

## Renovaciones

El listado conserva la gestión Pendiente/Contactado y enlaza al expediente para los desenlaces. Cambiar a Renovada o Perdida no sustituye registrar una nueva vigencia o documentar la no renovación. Los cierres existentes pueden conservar sus notas; no se permite trasladarlos a otra póliza ni reabrirlos por un simple cambio de estado.

- Guardar No renovada con su motivo actualiza los seguimientos a LOST y cierra la actividad automática.
- Volver a Por preparar, sin siguiente vigencia, devuelve seguimientos cerrados a PENDING para revisión.
- Registrar una nueva vigencia enlaza las pólizas, conserva el contrato y recibos anteriores, marca la preparación y los seguimientos como RENEWED y termina la actividad automática.

No se cancela cobertura por cambiar el estado de preparación. El retiro/actualización de eventos de renovación se realiza con la sincronización ya implementada.

## MCP, ayuda y verificación

Las reglas del servidor también se aplican al confirmar propuestas MCP. Un alta aislada de recibo o un cierre de renovación sin su flujo se rechazan antes de guardar una propuesta que no se podría aplicar. Crear/ajustar calendarios completos por MCP permanece como ampliación futura; la operación se ofrece ahora en el expediente.

Se añadieron tarjetas ilustradas, recorridos y Novedades. La navegación principal conserva su estructura; Por revisar aparece en Más.

Verificaciones:

- Pruebas unitarias de moneda, suma, fechas, pago único, huellas de revisión, reasignación selectiva, transiciones y rechazo anticipado de propuestas MCP incompatibles.
- `npm run operation:smoke`: integración transaccional con PostgreSQL, confirmación con comprobante ficticio, conservación de pagos, rechazo de propuestas inválidas y versiones antiguas, archivo/restauración, reasignación, cola y cierre/reapertura/nueva vigencia. Todas las fixtures y eventos se revierten; no usa almacenamiento ni envía mensajes.
- Navegador con API simulada: pagos bloqueados, propuesta equilibrada, regeneración a pago único con confirmación, navegación de altas/cierres al expediente, filtros de cola, escritorio y móvil.
- Comprobación completa del proyecto: esquema, lint, tipos, pruebas y compilación. Se conserva una advertencia previa de miniaturas de Drive.

No hay migración de esquema ni reasignaciones masivas. La validación visual en las cuentas reales de Google y el piloto de agentes de IA continúan pendientes.
