# Acciones y modales · revisión del 29/10/2026

## Criterio compartido

- Crear: Add; editar/renombrar/escribir: Edit2; consultar: Eye; ocultar vista previa: EyeSlash; guardar/confirmar: TickCircle; enviar: Send2/DirectSend; borrar: Trash; archivar: Archive; restaurar: ArrowRotateLeft; navegar: ArrowRight/ArrowLeft; conexiones: Link2; novedades: Note; ayuda: MessageQuestion.
- Navegación de Google Calendar y WhatsApp conserva sus marcas. El embudo usa Kanban, las tarjetas Category y el listado tabular RowVertical.
- La lista no ordenada del redactor usa BulletListIcon en `src/components/action-icons.tsx`: una extensión de la cuadrícula de 24 px y trazo de 1.5 px de Iconsax, porque el catálogo instalado no ofrece viñetas. No reutilizar alineación ni checklist para esa acción.
- Iconos auxiliares decorativos llevan aria-hidden y los botones conservan su texto o nombre accesible. Los cambios de modo deben cambiar texto e icono al mismo tiempo.
- No se añade un icono arbitrario a filtros, cancelaciones o enlaces de texto solo para llenar espacio.

## Revisión

Se inspeccionaron acciones y enlaces de los componentes, rutas de trabajo, menús de escritorio/móvil, cuenta, buscador y módulos compartidos. Se corrigieron la edición del redactor, el indicador de lista, la navegación a prospectos, Novedades en cuenta, el calendario, la redacción de correos y el registro de un aviso realizado por cualquier canal. Las acciones de guardado y edición de los módulos mantienen la misma convención. Los nombres, permisos y operaciones de negocio no cambian.

No se encontraron llamadas a window.alert/confirm/prompt ni elementos dialog nativos en la interfaz. Las confirmaciones ya utilizaban el proveedor propio. El ajuste visual se aplica al componente Modal compartido y al proveedor de confirmación; el login permanece igual.

## Diseño y comportamiento de ventanas

Modal admite `icon` opcional para un contexto explícito: no adivinar una acción a partir del título. Formularios usan cabecera, superficie sólida, campos, separación del pie y controles uniformes. Las confirmaciones peligrosas usan Warning2 y un tratamiento de color; la opción segura mantiene el foco inicial.

Conservar Escape, trampa de foco (incluyendo editores contentEditable), bloqueo de desplazamiento del fondo, retorno al disparador y el foco de la confirmación superior en ventanas anidadas. En móvil se usa la hoja inferior con desplazamiento del cuerpo y acciones visibles. El bloqueo de desplazamiento usa un contador compartido con el buscador; la restauración del foco ignora ventanas que se están cerrando. No cambiar validación, consentimiento, permisos ni confirmación de operaciones por un ajuste visual.

## Verificación

Comprobación de tipos y lint; pruebas existentes de temas, iconos, módulos y recorridos. Navegador con componentes reales y API simulada: formulario de prospecto, confirmaciones anidadas, foco seguro, Escape, restauración del foco, desplazamiento en 320/390 px, temas claro/oscuro/gradiente y redactor de correo con vista previa/edición. No se guardaron registros ni se enviaron correos durante estas pruebas de interfaz.

## Desplegables compartidos

Los 42 controles select visibles se sustituyeron por Select de `src/components/ui/select.tsx`, incluidos filtros GET del registro y el formulario de captura externo. El select nativo interno queda oculto únicamente para conservar validación, FormData y eventos React; su menú nunca se muestra. El botón combobox mantiene el nombre accesible, opciones deshabilitadas, valor y requisitos de cada campo. La lista se porta fuera del área desplazable del modal, se coloca según el espacio visible, conserva el tema y permite flechas, Inicio/Fin, escritura por prefijo, Enter, Escape y Tab. Escape cierra primero las opciones. Las pruebas de navegador comprobaron formularios controlados, eventos y FormData, validación, colocación en 320/390 px y los tres temas; sin escrituras al CRM.
