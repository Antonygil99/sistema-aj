# Catálogo de aseguradoras y productos

Actualización del 29/10/2026.

- Productos abre una tarjeta por compañía. Dentro de ella el gestor conserva búsqueda, paginación, activos/archivados, edición, imagen propia del producto y vínculos existentes.
- Los tres puntos y clic derecho de la tarjeta permiten editar descripción e imagen privada de la aseguradora. ADMIN/SUPERADMIN editan; USER consulta. Guardar usa la versión revisada y aplica descripción e imagen juntas; archivos reemplazados se limpian después de confirmar la fila. Formato PNG/JPG/WEBP hasta 4 MB con verificación del contenido, en la ruta privada `aj/insurers/`.
- El producto elige una aseguradora existente o una nueva. Crear o reasignar un producto enlaza/crea su perfil en la misma transacción. El responsable obligatorio pertenece al producto y debe ser un administrador activo; el perfil de compañía no tiene un responsable único ni un ramo fijo.
- La identidad normaliza mayúsculas/minúsculas y espacios, sin coincidencias aproximadas: nombres comerciales diferentes requieren revisión humana. No se fusionan ni borran productos porque compartan compañía.
- La migración `20261029235900_insurer_catalog` añade Insurer e insurerId opcional en Product, manteniendo el texto histórico. Se conservaron 89 productos y 444 pólizas y se enlazaron los productos a 20 compañías; sin productos huérfanos. No se reescribieron aseguradora, vigencias ni importes de pólizas históricas.
- No se borran perfiles vacíos automáticamente: pueden conservar imagen, descripción o productos archivados.
- La API de catálogo mantiene insurerId al buscar/paginar/cambiar activos y archivados. Los enlaces previos con open=producto resuelven la compañía correspondiente.
- Prueba SQL con sesiones humanas y rollback: varios ramos/administradores en un perfil, filtro por compañía, versiones, rechazo a un responsable USER y edición USER, conservación del productId de la póliza y cambio de administrador del producto. Navegador con datos simulados: tarjetas, menú, clic derecho, edición, nueva aseguradora/producto, selección de administradores, móvil y retorno del foco. No se enviaron correos ni se subieron imágenes reales en las pruebas.

La migración complementaria `20261029235930_product_company_names` permite nombres iguales de producto en diferentes compañías o ramos. La combinación compañía, ramo y nombre permanece única; no se cambian los nombres de los registros históricos.
