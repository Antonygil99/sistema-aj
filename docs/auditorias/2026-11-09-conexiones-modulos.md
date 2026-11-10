# Auditoría de conexiones entre módulos — 9 de noviembre de 2026

## Alcance y límites

Revisión de aseguradoras, productos, pólizas, expedientes, recibos, renovaciones, documentos, trámites y responsables. Se inspeccionaron validadores, rutas de escritura, relaciones y consumidores de los datos. Referencia inicial del código: `ce718e2`, antes de las mejoras de interfaz y validación que se están preparando en esta sesión.

Las consultas de producción fueron **exclusivamente de lectura**, con proyecciones limitadas y resultados agregados. No se modificaron pólizas, clientes, archivos, pagos ni permisos; no se enviaron correos ni mensajes. Este reporte no contiene nombres, números de póliza, correos, identificadores de expedientes ni credenciales.

La lectura de código permite identificar rutas que admiten inconsistencias; no equivale a haber enviado solicitudes de escritura a producción. Los ceros observados describen el corte de la auditoría, no garantizan ausencia de otros errores. No se validó la visualización real de los calendarios de los brokers ni se accedió al contenido privado de Drive/R2.

## Resultado agregado de producción

| Comprobación | Cantidad |
| --- | ---: |
| Pólizas no archivadas | 450 |
| Pólizas con estado ACTIVE | 307 |
| Pólizas ACTIVE sin producto vinculado | 5 |
| Pólizas ACTIVE sin responsable | 2 |
| Pólizas vinculadas cuya aseguradora difiere del producto | 0 |
| Pólizas vinculadas cuyo nombre de producto difiere del catálogo | 0 |
| Pólizas vinculadas a un producto archivado | 0 |
| Productos activos | 89 |
| Productos activos sin perfil de aseguradora | 0 |
| Productos cuya aseguradora textual difiere de su perfil | 0 |
| Productos activos sin responsable | 9 |
| Productos con responsable sin registro de acceso | 0 |
| Productos con responsable deshabilitado | 0 |
| Productos con responsable habilitado pero sin rol administrativo | 0 |
| Pólizas MetLife sin catálogo de Gastos Médicos | 0 |
| Recibos no archivados | 24 |
| Recibos con moneda distinta de su póliza | 0 |
| Recibos con vencimiento fuera de vigencia | 0 |
| Recibos no archivados bajo pólizas archivadas | 0 |
| Actividades pendientes vinculadas a pólizas | 12 |
| Actividades pendientes con responsable diferente al de su póliza | 0 |
| Actividades pendientes bajo pólizas archivadas | 0 |

Los **9 productos sin responsable tienen `ownerEmail` vacío**: 6 de ramo OTHER, 2 HOME y 1 LIFE. No se trata de cuentas bloqueadas o de roles insuficientes. Requieren una decisión de asignación; no debe inferirse una persona por el nombre de una aseguradora. Las diferencias textuales se compararon ignorando mayúsculas, acentos y espacios repetidos; un cambio histórico de nombre puede ser legítimo y no debe corregirse masivamente sin revisión.

## Hallazgos y acciones recomendadas

### 1. P1 — El catálogo no era una fuente coherente en todas las escrituras de póliza

**Evidencia inicial:**

- `src/modules/resources/config.ts:137`: `prefill` solo completa aseguradora, producto y responsable si están vacíos. Cambiar la selección de catálogo en una póliza existente conserva los textos anteriores.
- `src/modules/resources/server.ts:55`: al crear solo se hereda el responsable si no se envió uno. No se comprueba que aseguradora/producto correspondan al `productId`, ni que el producto y su perfil estén activos. La actualización no recalcula el responsable al cambiar producto.
- `src/app/api/dossiers/route.ts:23` y `src/app/api/dossiers/[id]/policies/route.ts:9`: las altas desde el expediente también aceptan los textos y el identificador por separado; sus helpers `responsible()` solo consultan el responsable.
- `src/components/dossier-wizard.tsx`: el selector de catálogo también conservaba aseguradora/producto ya capturados mediante `current.insurer || ...` y `current.product || ...`.

**Impacto:** una póliza puede apuntar a un producto y mostrar otra aseguradora o descripción. El campo textual `insurer` y `catalogProduct.line` se usan juntos para habilitar trámites (`src/modules/procedures/server.ts:57`); un dato contradictorio puede bloquear una plantilla válida o mostrar una elegibilidad equivocada. El responsable determina calendarios y seguimientos.

**Prioridad inmediata:** selector dependiente aseguradora → producto y una única resolución de catálogo en servidor para creación, edición y asistente de expedientes. Mantener un camino explícito para registros históricos no vinculados; no sustituir automáticamente sus datos. Verificar también la vía MCP, que termina en `createResource`/`updateResource`.

**Pruebas recomendadas:** elegir producto de otra aseguradora en una póliza ya llena; enviar un `productId` con textos contradictorios por API; seleccionar producto archivado; cambiar producto en un expediente; conservar una póliza histórica sin catálogo sin inventar una asociación.

### 2. P2 — Hay pendientes reales de vinculación y asignación

Existen 5 pólizas ACTIVE sin catálogo, 2 sin responsable y 9 productos activos sin responsable. No se identificaron divergencias en las pólizas que sí están vinculadas.

**Impacto:** `src/modules/calendar/payments-server.ts:26` y `src/modules/calendar/renewals-server.ts:26` seleccionan únicamente registros cuyo `ownerEmail` coincide con el broker. Una póliza sin responsable no aparece en sus calendarios. Esto protege el aislamiento, pero necesita un estado visible de «Por asignar» para que el equipo no lo confunda con un fallo de Google.

**Acción:** mostrar un indicador de integridad y una cola de revisión administrativa con los registros faltantes; completar catálogo y responsable con una persona. No corregir masivamente por ramo o aseguradora.

**Pruebas:** la póliza asignada aparece exclusivamente para su broker; la no asignada no se distribuye a todos y se incluye en la cola administrativa; un producto sin responsable obliga a elegirlo antes de activar las automatizaciones correspondientes.

### 3. P2 — Cambiar el responsable de una póliza no reasigna todos sus seguimientos existentes

**Evidencia:** el editor genérico actualiza `Policy.ownerEmail` en `src/modules/resources/server.ts:86`, pero no actualiza las actividades relacionadas. `src/modules/polizas/delivery-server.ts:48` consulta el responsable de la póliza y lo usa al crear seguimientos, mientras que la actualización de actividades existentes solo cambia estado/fecha. `src/modules/procedures/server.ts:34` actualiza fechas/estado de su seguimiento sin reasignar el responsable.

**Impacto:** después de una reasignación, el calendario usa al broker nuevo y una actividad pendiente puede seguir apareciendo en el resumen del anterior. En el corte actual no hay actividades pendientes con este desajuste: el riesgo se encuentra en la operación de cambio.

**Acción:** definir una operación transaccional de reasignación de póliza y sus seguimientos automáticos pendientes. Conservar responsables de actividades manuales cuando su asignación sea deliberada y conservar el historial de actividades terminadas.

**Prueba:** crear seguimientos de entrega, renovación y trámite; reasignar la póliza; comprobar tablero, resumen diario y calendario de ambos brokers sin duplicados.

### 4. P2 — Los recibos creados o editados desde el módulo genérico no pasan por todas las reglas del calendario contractual

**Evidencia:** `src/modules/pagos/schema.ts` valida importe/moneda/formato y estado-fecha, pero no compara moneda/vencimiento con su póliza. `src/modules/resources/server.ts:53` bloquea marcar PAID por esta vía, pero acepta recibos pendientes sin estas comparaciones. La creación revisada desde `src/modules/polizas/finance-server.ts:19` sí comprueba vigencia, suma y periodicidad mediante `scheduleIssues`.

La edición genérica de una póliza sin historial de renovación también puede cambiar moneda, prima o vigencia aunque ya tenga recibos; el bloqueo `FINANCE_POLICY_HISTORY` solo se activa si existe una vigencia anterior o siguiente (`src/modules/resources/server.ts:69`).

**Impacto:** una escritura posterior puede producir un recibo con moneda diferente, vencimiento fuera del contrato o un calendario que ya no suma la prima. En el corte actual no se encontraron diferencias de moneda ni fechas fuera de vigencia.

**Acción:** reutilizar validaciones contractuales en las altas/ediciones de recibos y comprobar el efecto de editar la póliza cuando ya existen pagos. Los recibos confirmados deben mantener sus controles de referencia/evidencia e historial.

**Pruebas:** intentar moneda diferente de la póliza, vencimiento externo a vigencia, cambio de vigencia con recibos existentes y modificación de prima que deje de coincidir con el calendario.

### 5. P3 — El estado genérico de renovación y el flujo de preparación no siempre representan la misma acción

**Evidencia:** `src/modules/renovaciones/schema.ts` permite guardar RENEWED/LOST directamente en una fila de `Renewal`. El calendario de Google se basa en `Policy.nextPolicy` y `RenewalPreparation.status`, no en esa fila (`src/modules/calendar/renewals-server.ts:27`). El flujo completo `renewPolicy()` en `src/modules/polizas/finance-server.ts:61` sí enlaza vigencias y actualiza las entidades relacionadas.

En producción hay 2 renovaciones cerradas no archivadas; 1 no tiene siguiente vigencia ni preparación cerrada. Ninguna de esas diferencias corresponde a una póliza ACTIVE futura con responsable que resulte elegible para el calendario actual. No se afirma que hoy exista un evento duplicado por este motivo.

**Acción:** aclarar en la UI la diferencia entre registrar seguimiento y registrar la nueva vigencia. Preferir la operación del expediente para completar una renovación y sincronizar los demás estados.

**Prueba:** cerrar una renovación desde el expediente y desde el listado; comparar su estado, nueva vigencia, actividad pendiente y evento de Google.

## Comprobaciones positivas

- Los productos activos actuales tienen perfil de aseguradora y las relaciones vinculadas observadas coinciden.
- La creación de calendarios de recibos desde el expediente verifica suma, periodicidad y fechas, y deja recibos pendientes.
- La confirmación de pago valida evidencia del mismo expediente/póliza; Drive se verifica con la cuenta del actor antes de guardar.
- La renovación desde el expediente conserva la vigencia anterior, crea la nueva, actualiza seguimiento y evita repetir una vigencia ya enlazada.
- Las referencias documentales de R2 y Drive tienen controles de ámbito. No se observó una relación documental cruzada explotable en los archivos revisados; esto no sustituye una auditoría de seguridad completa.
- La restricción actual de trámites a MetLife/Gastos Médicos es un piloto explícito. Una póliza HDI no debe presentarse como compatible con esa plantilla. La UX puede explicar el alcance sin abrir un selector vacío.

## Orden sugerido

1. Resolver la coherencia de catálogo en UI y servidor de todas las entradas de pólizas.
2. Habilitar revisión administrativa de catálogo/responsables faltantes sin asignar automáticamente datos de producción.
3. Unificar reasignación de póliza y seguimientos automáticos pendientes.
4. Compartir las reglas contractuales entre recibos y cambios de póliza.
5. Unificar el cierre de renovaciones y continuar con las pruebas reales de Google/MCP por broker.

Este documento registra el diagnóstico inicial. Las correcciones del rediseño deben verificarse y anotarse después; no se dan por realizadas por la mera existencia de este reporte.


## Seguimiento de implementación

Los hallazgos de este corte inicial se atendieron con la selección relacionada de catálogo y la [entrega de operación financiera y cola de revisión](2026-11-09-operacion.md). Los datos faltantes se mantienen visibles para revisión humana; el reporte enlazado distingue las correcciones de código y las capturas que todavía requieren documentos reales.
