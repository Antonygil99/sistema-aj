# Importación de clientes y catálogo

El 13 de octubre de 2026 se importó el consolidado de producción/pagos proporcionado por Tony. Contiene 2,131 movimientos y 389 variantes de nombres; al normalizar únicamente espacios, mayúsculas y Unicode, hay 362 nombres únicos. No se usaron coincidencias aproximadas ni se reordenaron apellidos. La agrupación por nombre requiere verificar identidad con RFC/contacto cuando esos datos estén disponibles.

Se crearon 362 expedientes, 25 entradas de catálogo por combinación de ramo y aseguradora, y cuatro carpetas por expediente: Identificación, Pólizas, Pagos y Siniestros. Los nombres del catálogo representan categorías reportadas por el origen, no nombres comerciales ni coberturas confirmadas. El catálogo distingue autos individuales, camión/pickup, daños empresariales, responsabilidad civil profesional, casa habitación, gastos médicos individuales y accidentes de grupo.

El archivo no contiene contacto, RFC, vigencia completa de la póliza, prima total de póliza ni fecha efectiva del pago. Sus importes corresponden a recibos y varios tienen más de dos decimales. Hay movimientos Pagado, Aplicado, Cancelado, Por aplicar y Facturado. Cinco movimientos tienen códigos de moneda `100`/`200` sin equivalencia confirmada. Por ello no se crearon pólizas ni pagos, y no se declararon clientes activos a partir de este historial.

Los datos originales, la preparación, el manifiesto de IDs y el reporte de pendientes se conservaron fuera del repositorio público, en los archivos de trabajo de esta conversación. No publicar archivos de clientes, nombres, pólizas, importes o credenciales en Git.

## Repetición segura

`scripts/import-client-catalog.mjs` consume un JSON preparado versión 1 con origen/hash, clientes y catálogo. Revisa nombres normalizados contra la cartera existente, rechaza coincidencias ambiguas o registros archivados y nunca sobrescribe datos existentes. Usa transacción serializable, bloqueo entre importadores e IDs deterministas. No genera datos de pólizas o pagos.

```powershell
node scripts/import-client-catalog.mjs C:\ruta-privada\datos-preparados.json
# Simulación: reporta altas/reutilizaciones y revierte la transacción.
node scripts/import-client-catalog.mjs C:\ruta-privada\datos-preparados.json --apply
# Carga autorizada: verifica los registros y guarda un manifiesto junto al JSON.
```

Mantener los datos de entrada en una carpeta privada fuera del repositorio. La conexión se toma de `.env`/entorno del servidor y nunca se registra en la salida. Las fechas y cifras pendientes deben corroborarse con pólizas/recibos originales antes de una segunda importación de operaciones financieras.
