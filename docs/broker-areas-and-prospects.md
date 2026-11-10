# Prospectos por ramo y áreas de operación

Joel opera Autos. Ale opera Gastos médicos mayores, Vida y Accidentes personales. Este último conserva un ramo propio para las pólizas de accidentes que antes estaban clasificadas como Otro. El superadmin puede asignar más ramos desde **Usuarios y accesos → Áreas de trabajo**. El catálogo de aseguradoras/productos y los contactos básicos de clientes siguen compartidos; las operaciones se filtran por ramo en las pantallas, API y MCP.

## Alta y seguimiento

- El seguro de interés controla los campos. Autos muestra sexo, edad, CP, vehículo, periodicidad, medio de pago y notas; no muestra el diagnóstico médico.
- Periodicidad (mensual, anual, etc.) y medio (tarjeta, transferencia, etc.) son distintos. La ficha puede completarse gradualmente.
- Para otra contratación de un cliente, selecciona **Cliente existente**. El nombre y contacto provienen de su expediente; edítalos allí. Cada oportunidad conserva su propio ramo y seguimiento.
- Etapas: Curioso → Información recibida → Diagnosticado → Propuesta enviada → Documentación → Emisión. Pérdida se elige explícitamente. Emisión no convierte automáticamente ni implica pago.
- **Continuar contratación** registra la póliza y sus recibos en el expediente existente. La conversión es atómica y no duplica al cliente. Varias oportunidades pueden contratar en el mismo expediente.
- Comparativo guiado permanece como etapa histórica. Los registros previos no se cambian de etapa automáticamente. Una oportunidad con diagnóstico guardado no se cambia de ramo: crea otra para conservar su historia.
- Las importaciones de prospectos también eligen ramo. Las que se preparen por MCP pueden indicarlo con `line`; si se omite se propone el ramo predeterminado de la cuenta y se valida al aplicar.

## Activación y datos existentes

1. Ejecutar las comprobaciones y la migración `20261111120000_broker_areas_and_prospect_lines` antes de arrancar el código nuevo. Es aditiva: conserva documentos, recibos y diagnósticos; retira únicamente la unicidad de la relación de conversión para permitir varias oportunidades por cliente.
2. Configurar las áreas de los administradores **antes de habilitar el nuevo despliegue**. Las cuentas sin áreas no acceden a operaciones. Se puede usar la UI del superadmin después de migrar o el script privado:

```powershell
node scripts/broker-areas.mjs --email=cuenta-del-broker --lines=AUTO
node scripts/broker-areas.mjs --email=cuenta-del-broker --lines=AUTO --apply
# Para la otra cuenta: --lines=MEDICAL,LIFE,ACCIDENT
```

3. Revisar la clasificación histórica: pólizas vinculadas heredan el ramo del catálogo; otras se clasifican solo mediante señales de producto/vehículo. Las ambiguas quedan sin ramo y solo las ve el superadmin hasta clasificarlas. Las cotizaciones heredan el ramo de su prospecto. El script informa cuántos prospectos del propietario están fuera de las áreas seleccionadas y no los altera. Durante la activación se revisaron los nueve prospectos asignados a Joel: no tenían diagnóstico médico y se clasificaron como Autos sin cambiar sus etapas ni contactos. Los registros sin responsable conservaron su clasificación original.
4. Comprobar con cada cuenta: contactos compartidos editables; productos de todos los ramos consultables; altas de Autos para Joel y GMM/Vida para Ale; detalles/pagos/renovaciones del otro ramo inaccesibles incluso con un ID directo o por MCP.

Los cron e integraciones internas autenticadas conservan alcance de sistema; las credenciales internas no deben compartirse con usuarios ni conectores MCP. Cambiar áreas no requiere reconectar MCP: cada solicitud vuelve a consultar el acceso vigente.

Se puede repetir la verificación de lectura con las credenciales privadas del entorno y ambos correos como argumentos:

```powershell
node --import ./scripts/server-test-loader.mjs --import tsx scripts/verify-broker-areas.mts correo-autos correo-salud-vida
```

Comprueba los ramos esperados, las relaciones anidadas del expediente, los contactos y el catálogo compartidos y el rechazo de IDs de otra área. No modifica registros ni inicia sesiones de usuarios.

## Límites

La ficha de Autos es una oportunidad comercial, no una solicitud oficial ni confirmación de cobertura. No se considera emitida o pagada ninguna póliza por completar estos datos. Casa y Viaje están disponibles como ramos configurables; requieren definir sus cuestionarios antes de automatizar su captura especializada.
