# Tableros de seguimiento · 12 de noviembre de 2026

Prospectos: Curioso → Información recibida → Diagnóstico → Propuesta enviada → Documentación recibida. Desde documentación se puede solicitar emisión o marcar Emitida. Emisión solicitada permite Información adicional o Firma; información adicional pasa a Reenvío emisión, que permite volver a completar información o pasar a Firma. Firma pasa a Emitida. Pérdida es una decisión manual; no se aplica por avanzar el tablero. La conversión en cliente sigue siendo una operación independiente.

Compatibilidad: se conservan DOCUMENTACION y DIAGNOSTICADO como identificadores internos. EMITIDA es nueva: EMISION conserva el significado histórico y se muestra como “Emisión (anterior)” solo cuando existen registros. CLIENTE continúa en lista. No se reescriben etapas históricas.

Siniestros: Abierto, En revisión y Cerrado continúan disponibles para todos los ramos. Autos añade Tránsito → Taller o Asistencia vial → Valuación autorizada. A partir de la valuación hay dos recorridos: Refacciones → Reparación → Entregado, o Pago de daños → Documentación de daños → Pagado. El servidor rechaza las etapas de Autos para pólizas de otros ramos, también desde MCP. Entregado, Pagado y Cerrado son terminales para indicadores y avisos; no se genera ni confirma una transacción financiera.

Los tableros conservan búsqueda, edición, permisos por póliza y control de cambios simultáneos. Las acciones indican la etapa destino. Colores acompañados de etiquetas y contadores, temas claro/oscuro y desplazamiento horizontal en móvil. Las páginas de cien registros tienen navegación explícita; los contadores de columna corresponden a la página visible.

Migración aditiva: 20261112120000_workflow_boards. No elimina filas ni cambia estados existentes. Validación: pruebas de rutas alternativas, estados terminales, esquema, permisos de ramo, tipos y compilación.
