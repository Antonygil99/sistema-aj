# Importación del control de pólizas

Fecha: 13 de octubre de 2026. Origen: archivo de control de agosto de 2026 proporcionado por Tony, con 574 filas en dos hojas. Los originales y los datos preparados permanecen fuera del repositorio público.

Se crearon 86 clientes, 442 pólizas, 64 productos/coberturas y 344 carpetas. Se reutilizaron 247 expedientes y se completaron 142 campos de contacto que estaban vacíos. Una segunda simulación produjo cero altas y cero cambios de contacto. No se sobrescribieron contactos existentes ni se crearon pagos. Antes había 362 clientes y 25 categorías de catálogo; después de esta carga hay 448 clientes y 89 entradas de catálogo.

## Criterios

- Números numéricos de póliza y teléfonos provenientes de Excel se convierten sin el sufijo `.0`; se conservan los números de póliza con guiones y otros caracteres originales.
- Se normalizan únicamente espacios, mayúsculas y Unicode para coincidencias exactas. Once variantes de nombre se vincularon con apoyo de una misma póliza y aseguradora en el consolidado previo y los mismos componentes de nombre; la evidencia está en el JSON privado preparado.
- Cinco nombres potencialmente duplicados sin esa evidencia se retuvieron. No se fusionaron registros por similitud solamente.
- Solo se rellenan contactos vacíos. Correos compartidos entre distintos clientes, teléfonos inválidos o datos contradictorios permanecen en el reporte privado de pendientes.
- Tony confirmó MXN, excepto productos que indiquen UDI u otra moneda. El producto de vida en UDI se incluyó en el catálogo, pero su póliza y prima no se cargaron como MXN.
- Los productos reflejan ramo, cobertura/plan y aseguradora tal como aparecen en el archivo. No se completan condiciones, sumas aseguradas ni responsabilidades comerciales ausentes.
- Se colapsan filas repetidas únicamente si coinciden cliente, aseguradora, vigencia, prima, frecuencia y cobertura. Se conservan todas las ubicaciones de origen en `Policy.sourceData`.
- Quince grupos de números de póliza requieren revisión por contradicciones, vigencias múltiples bajo un número globalmente único, registros de cotización/inactividad, UDI o datos incompatibles. Además hay registros retenidos por nombres ambiguos. Revisar el CSV privado; no alterar el número de póliza para eludir su restricción única.
- Los estados se evalúan con vigencia al 13 de octubre de 2026: 299 pólizas ACTIVE, 142 EXPIRED y una CANCELLED. La interfaz calcula cobertura actual; no se equipara ACTIVE con haber cobrado.
- Prima total y frecuencia sí se cargan. Primer recibo, importes subsecuentes y vencimiento reportado se conservan en `sourceData` para conciliar. No se generan automáticamente recibos ni fechas efectivas de pago a partir de estos importes.

## Ejecución

`scripts/import-policy-register.mjs` usa una transacción serializable y el bloqueo común de importadores. Su JSON preparado versión 2 tiene clientes, productos, pólizas con moneda validada y procedencia. Los IDs son deterministas; se verifican las altas dentro de la transacción. Campos existentes se preservan y diferencias se reportan en el manifiesto privado.

```powershell
node scripts/import-policy-register.mjs C:\ruta-privada\datos-preparados.json
node scripts/import-policy-register.mjs C:\ruta-privada\datos-preparados.json --apply
```

La migración de `Policy.sourceData` es aditiva. Los campos de captura opcionales `coverage`, `vehicle`, `plates` y `vehicleUse`, añadidos en paralelo por otro colaborador, se rellenan si están disponibles; la procedencia conserva esos datos independientemente de esas columnas.

Se ejecutaron esquema, lint, tipos, 54 pruebas existentes y compilación local. La validación de importación fue contra la base configurada real, seguida de simulación idempotente. Falta conciliación del consolidado de movimientos pagados con pólizas originales y los casos del reporte privado.
