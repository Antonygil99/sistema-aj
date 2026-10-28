# Novedades y tutoriales de Sistema AJ

La página privada `/novedades` reúne el historial de funciones, mejoras y correcciones. El catálogo editorial está en `src/modules/help/releases.ts` y se reconstruyó con los cambios del repositorio desde el 12 de octubre de 2026. Los permisos se filtran en el servidor antes de entregar el contenido al navegador. Las integraciones descritas requieren su configuración; el historial no certifica aprobaciones de Meta ni conexiones de cada usuario.

## Uso del equipo

- Abrir **Novedades** en el menú lateral, el menú móvil, la cuenta o el Centro de ayuda.
- Buscar por nombre o módulo y filtrar por tipo de cambio. **Abrir** lleva a la pantalla; **Ver recorrido** inicia la explicación.
- En un expediente, la tarjeta **La ficha la puede llenar tu cliente** inicia un recorrido ilustrado. Cerrar la tarjeta se recuerda en las preferencias de la cuenta, sin desactivar el tutorial.
- **Cómo usar esta ficha** sigue disponible dentro de la ficha. Desde el Centro de ayuda se puede repetir en **Funciones nuevas**. La opción existente para reiniciar los recorridos también vuelve a mostrar las tarjetas.
- Los recorridos de fichas y finanzas se explican desde Expedientes si no hay un cliente abierto. Dentro de un expediente señalan sus controles reales. El de ficha abre el panel y espera su consulta, pero no crea enlaces, guarda respuestas, aprueba datos o envía mensajes. Los controles resaltados no se pueden accionar mientras se explica el paso.
- WhatsApp y Novedades tienen nuevos recorridos de módulo. Pagos y renovaciones tiene acceso al recorrido dentro de su panel.

## Agregar una entrega futura

Regla de producto confirmada por Tony el 27/10/2026: **cada función nueva debe tener su tarjeta ilustrada y tutorial de descubrimiento**. La ilustración debe explicar esa función (por ejemplo, recibos para pagos, agenda para citas o ficha para captura); no reutilizar la ilustración de formularios para todas las funciones. Mantener el mismo estilo visual, cierre recordado por cuenta y acceso para repetir desde Ayuda. Las correcciones pequeñas pueden registrarse solo en el historial, sin interrumpir al equipo con una tarjeta.

1. Verificar la función realmente publicada y sus permisos. No presentar trabajo pendiente o una integración sin configurar como una aprobación completada.
2. Agregar al principio de `releases.ts` una entrega con ID único, fecha `AAAA-MM-DD` de Ciudad de México, título y resumen para el usuario. Se permiten varias entregas el mismo día.
3. Agregar cambios con ID único, área, tipo `feature` / `improvement` / `fix`, texto, ruta interna y, cuando aplique, `minRole` y `tour`.
4. Registrar el recorrido en `src/modules/help/tours.ts`. Usar identificadores `data-tour` estables; los pasos sin control visible se omiten. El texto explica acciones, nunca las ejecuta por el usuario. Mantener los textos breves.
5. Incluir la tarjeta contextual de la nueva función, su ilustración correspondiente y el botón para iniciar el recorrido. Su ID `novedad:...` en preferencias distingue cerrar la tarjeta de ver el recorrido `funcion:...`. No guardar datos de clientes en estas preferencias.
6. Comprobar los enlaces, filtros, recorridos, teclado, móvil y temas claro/oscuro. Los tests de catálogo detectan IDs repetidos, fechas desordenadas, destinos externos y recorridos incompatibles con el rol.

No hay generación automática desde Git ni una tarea de mantenimiento programada: cada entrega debe incluir su entrada editorial al publicar la función. La página y los tutoriales se mantienen en la misma versión del código.
