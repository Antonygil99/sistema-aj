# Piloto de trámites administrativos GMM

Implementación del 27/10/2026. No depende de la aprobación de organización/proveedor de Meta. Reutiliza la ficha administrativa del cliente; la entrevista automática por WhatsApp y los otros siete formatos siguen fuera del piloto.

## Flujo disponible

1. En el expediente, abrir **Trámites y cambios de póliza**, elegir una póliza MetLife con producto del catálogo `MEDICAL` y preparar **Cambio de domicilio** o **Corrección de RFC**. Confirmar GMM individual antes de revisar. Pólizas canceladas, otros ramos y otras aseguradoras no usan este formato.
2. El trámite conserva una copia de la ficha aprobada disponible al crearlo. **Tomar datos de la ficha aprobada** propone nombres separados, RFC y contacto. No divide nombres completos ni asume que el cliente es el contratante. El domicilio nuevo se captura por separado.
3. Completar y guardar el borrador, con próximo seguimiento opcional. Confirmar identidad de persona física contratante, modalidad individual y que plantilla/canal corresponden al caso. La confirmación se hace por persona autorizada, no por IA.
4. Vincular archivos activos del mismo cliente/póliza: identificación, Formato 5 y comprobante de domicilio cuando corresponda. El Formato 5 no estaba en el lote recibido y no se inventa. Firmas y endosos se vinculan como archivos, sin fabricarlos.
5. Confirmar **Datos revisados** y preparar el PDF. La salida es un borrador con portada de pendientes más las dos páginas oficiales conservadas. No está presentado ni firmado por generarse. La aceptación de documentos electrónicos por correo queda sin marcar.
6. Registrar **Pendiente de firma**, **Presentado a aseguradora** con folio y fecha real, y **Endoso recibido** con documento y fecha efectiva. Presentar exige anexos y solicitud firmada; cerrar exige endoso. Ninguna transición modifica `Policy` ni `Payment`, envía a la aseguradora o interpreta cobertura.
7. Programar/reprogramar seguimiento crea o actualiza una sola actividad `TRAMITE_<id>`. Cerrar/cancelar completa esa actividad. El tablero privado `/tramites` muestra hasta 100 trámites accesibles y sus indicadores; los números corresponden a esa lista.

## Datos y permisos

- Tablas nuevas: `InsuranceProcedure`, `ProcedureRevision`, `ProcedureAttachment`, `ProcedureExport`, `InsuranceTemplate`; migración aditiva `20261027020000_insurance_procedures`. No transforma clientes, pólizas o recibos existentes.
- Se requiere sesión humana ADMIN/SUPERADMIN. El token de integración sin identidad se rechaza. El superadmin puede consultar todo; los administradores acceden como creadores o responsables de la póliza. Al crear, una póliza asignada a otro responsable se rechaza; una no asignada puede iniciarla un administrador. Esto no cambia la asignación comercial.
- Entradas estrictas y administrativas, cuerpos JSON acotados, Origin validado por autenticación existente, respuestas privadas `no-store`. No hay enlace externo de captura de trámites en este piloto; el enlace externo existente corresponde a la ficha del cliente.
- Cada mutación bloquea la fila, verifica revisión y crea un snapshot del estado/datos/anexos activos con actor. Las referencias a documentos impiden eliminarlos físicamente mientras se conservan en el trámite; archivos archivados no satisfacen los anexos requeridos.
- No se guardan historias clínicas, CLABE, tarjetas o firmas como datos de este formulario ni se dan nuevas herramientas a los agentes. Los eventos generales registran solo revisión/etapa, sin RFC, domicilios o texto de anexos.
- Crear utiliza una llave de solicitud única. Un PDF por revisión, archivos históricos conservados. Un cambio de póliza posterior al inicio bloquea nueva exportación y exige preparar una solicitud con la versión actual, conservando el caso anterior.

## Plantilla y PDF

Se utiliza exclusivamente `IG-2-020 VER. 11`, SHA-256 `0030dd03d728710d6b94a114524de8d6c1595864c2ef6130923de367e08f87c9`. El original se conserva como bytes privados en PostgreSQL, con ID y hash fijados; no se incluye en Git público. `scripts/provision-procedure-template.ts <ruta-pdf>` comprueba hash antes de insertar y nunca reemplaza una copia existente distinta. Se ejecuta con las variables privadas de base y `node --conditions=react-server --import tsx`.

Los archivos generados se guardan en R2 privado y se descargan por una ruta autenticada que entrega un enlace firmado corto. No aparecen como documentos generales automáticamente; el asesor puede descargarlos y subir el firmado al expediente. La generación usa el cliente R2 ya configurado en Vercel.

Mapa semántico parcial validado visualmente sobre las dos páginas: nombres separados/contacto/lugar/fecha/póliza, RFC en campo base de 10 posiciones y homoclave de 3 (`undefined`), casilla `3` domicilio o `4` RFC, detalle `anexar`, fecha solicitada y correo del titular. Todas las demás casillas quedan apagadas; especialmente `12` no acepta la autorización por correo. Firmas y cotejo del agente quedan en blanco. Los campos se mantienen editables, con valores canónicos y apariencias actualizados. La portada distingue el borrador del formato oficial.

Se detiene si el hash/cantidad de páginas o campos difiere, un valor no cabe legiblemente o un carácter no puede representarse. No se recorta silenciosamente ni se fuerza la aceptación de otra versión. Esta preparación técnica no certifica aceptación universal por MetLife; Ale confirma producto, canal, anexos y versión para cada caso.

## Código y verificación

- Dominio: `src/modules/procedures/schema.ts`, `server.ts`, `pdf.ts`.
- Equipo: `/tramites`, `/tramites/:id`, panel en expediente y rutas `/api/dossiers/:id/procedures`, `/api/procedures/:id` con operaciones de anexos, estado, seguimiento y PDF.
- Tarjeta con ilustración propia `policy-procedure.svg`, recorrido `funcion:tramites`, entrada en Novedades. Los recorridos no ejecutan cambios.
- Tests de esquema administrativo, anexos y confirmación. `scripts/procedures-pdf-smoke.ts <original> [carpeta-salida]` verifica ambos cambios, 47 campos, una casilla seleccionada y firmas vacías.
- `scripts/procedures-smoke.ts` comprueba contra PostgreSQL en una transacción revertida: alcance, versiones, anexos de otro cliente, revisión, exportación idempotente, etapas y actividad única. El almacenamiento de salida se simula en esta prueba; no manda mensajes ni altera pólizas/recibos reales.
- La interfaz se verificó con componentes reales y API simulada en navegador: prellenado sin asumir identidad, revisión explícita, PDF, tutorial, móvil y modo oscuro. Las salidas de ejemplo se reabrieron con `pypdf` para cotejar árbol canónico/widgets/apariencias y se inspeccionaron visualmente.

Siguiente ampliación: piloto real con Ale; confirmar Formato 5 y anexos; ampliar a cambios Vida tras neutralizar la selección heredada y revisar su mapa; catálogo de Autos con Joel. Firma electrónica, captura clínica/bancaria, envíos automáticos y aceptación de endosos siguen separados de este flujo.
