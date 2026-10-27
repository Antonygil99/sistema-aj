# Calendario, pagos y renovación por vigencia

Desde un expediente de cliente, abrir «Recibos, pagos y renovación» en cada póliza. USER consulta; ADMIN y SUPERADMIN gestionan.

- Un calendario nuevo solo se crea si la póliza no tiene ningún recibo, incluidos los archivados. La propuesta reparte centavos y respeta fin de mes; la persona corrige importes y fechas contra los documentos antes de confirmar. No se genera por abrir una pantalla ni se marcan recibos como pagados. Los existentes se conservan.
- Los importes deben sumar exactamente la prima total de esa vigencia y moneda, con fechas ordenadas dentro de la cobertura. UDI requiere revisión separada, sin conversión a MXN. El campo importado `paymentsNeedReview` solo se libera al guardar un calendario revisado.
- Confirmar un pago requiere fecha efectiva no futura, referencia y un documento activo de la misma póliza o general del mismo expediente. No se aceptan evidencias de otro cliente. La operación valida la versión y conserva el comprobante. Un pago confirmado no se edita, archiva o elimina desde el CRUD general; las correcciones/reversiones necesitan un flujo futuro de revisión.
- La renovación crea una póliza-vigencia nueva y una relación `previousPolicyId` / `nextPolicy`. No sobrescribe prima, número ni fechas anteriores. Los recibos y documentos anteriores no cambian de vigencia. El número real puede mantenerse si así lo emitió la aseguradora: la unicidad pasa a aseguradora+número+fecha de inicio. Un periodo no puede tener dos sucesores.
- Las vigencias vinculadas protegen número, aseguradora, moneda, prima e inicio/fin frente al editor general. No hay renovación automática ni envío nuevo al cliente. Las renovaciones pendientes del periodo anterior se marcan resueltas al confirmar la emisión de la siguiente vigencia.
- El calendario siguiente se prepara por separado. Los siniestros siguen en su póliza original. El legado de importación conserva criterios conservadores y retiene ambigüedades; no ejecutar cargas históricas para sustituir vigencias nuevas.

Migración `20261026010000_policy_finance`: no elimina filas; añade vínculos, referencia/evidencia de recibos y ajusta la unicidad de póliza. El seed se adapta, pero no se ejecuta en producción.

Validación: pruebas puras en `tests/finance.test.ts`, tipos, lint y build. `node --conditions=react-server --import tsx scripts/finance-smoke.ts` comprueba en una única transacción revertida calendario, bloqueo de duplicados, alcance de evidencia, confirmación, renovación con el mismo número y protección del historial. No deja fixtures, no envía correo/WhatsApp y no transforma cobros históricos del Excel en pagos confirmados. La conciliación completa y revisión de datos reales por el equipo siguen pendientes.
