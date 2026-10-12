# Documentos en Cloudflare R2

Documento de continuidad del módulo Documentos: arquitectura, estado actual y pendientes.

## Arquitectura

Los archivos viven en un bucket privado de R2. PostgreSQL (`Document`) guarda solo los metadatos: nombre original, `storageKey`, tipo MIME y un enlace opcional a cliente, póliza o siniestro. El navegador nunca recibe la clave del bucket ni un enlace permanente.

| Capa | Archivo | Responsabilidad |
| --- | --- | --- |
| Política | `src/modules/documentos/file-policy.ts` | Límite de tamaño, tipos permitidos, firma binaria (magic bytes), nombre seguro, lectura acotada del multipart y formato de claves gestionadas |
| Orquestación | `src/modules/documentos/file-operations.ts` | Carga y descarga contra las interfaces `DocumentRepository` y `FileStorage`; sin dependencias de servidor, por eso se prueba con objetos en memoria |
| Conexión | `src/modules/documentos/files.ts`, `src/integrations/r2/server.ts` | Une la orquestación con Prisma y el cliente R2 real (`server-only`) |
| Cliente R2 | `src/integrations/r2/client.ts` | Valida la configuración y expone `put`, `remove`, `exists` y `downloadUrl` mediante el SDK S3 |
| API | `src/app/api/documents/route.ts`, `src/app/api/documents/[id]/download/route.ts` | Listado/búsqueda, carga y descarga |
| Interfaz | `src/components/documents-page.tsx` (servidor), `src/components/document-library.tsx` (cliente) | Pantalla `/crm/documentos` |

### Carga (`POST /api/documents`, rol ADMIN)

1. `boundedFormData` exige `multipart/form-data` y corta la lectura al superar `MAX_REQUEST_BYTES`, incluso sin `Content-Length`.
2. El formulario solo admite `file` y, como máximo, uno entre `clientId`, `policyId` y `claimId`. Sin enlace, el archivo queda como "General".
3. `validateFile` comprueba el tamaño (1 byte a 4 MiB), un nombre limpio de hasta 180 caracteres, que la extensión coincida con el MIME y la firma binaria del contenido.
4. Se verifica que exista el expediente enlazado **antes** de escribir en R2.
5. Se sube a `aj/documents/<uuid>.<ext>`. La clave es nueva en cada carga, así que nunca se sobrescribe otro archivo.
6. Se crea la fila `Document`. Si PostgreSQL falla, se borra únicamente el objeto recién subido. Si ese borrado también falla, se registra `R2_ORPHAN_CLEANUP_REQUIRED`.

Tipos permitidos: PDF, JPEG, PNG, WebP, MP3, OGG, WAV y MP4.

### Descarga (`GET /api/documents/{id}/download`, cualquier rol)

Solo se sirven filas cuya `storageKey` cumple el formato gestionado (`isManagedKey`). Las referencias heredadas creadas con la antigua ruta genérica no producen enlaces. La API comprueba que el objeto exista y responde 303 hacia una URL firmada que caduca en 60 segundos, con `Content-Disposition: attachment`, `Cache-Control: private, no-store` y `Referrer-Policy: no-referrer`.

### Rutas cerradas

`POST /api/crm/documentos` responde 405 `USE_DOCUMENT_UPLOAD`. `GET /api/crm/documentos` omite `storageKey`.

## Configuración

Variables de servidor (Vercel Production y `.env` local):

| Variable | Formato |
| --- | --- |
| `R2_ENDPOINT` | `https://<account-id de 32 caracteres hex>.r2.cloudflarestorage.com` (se aceptan las variantes `.eu` y `.fedramp`), sin ruta ni puerto |
| `R2_BUCKET_NAME` | Nombre del bucket privado |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | Token de API de R2 con permiso de lectura y escritura de objetos, limitado a ese bucket |

Si falta alguna variable, la pantalla muestra la biblioteca, pero la carga y la descarga aparecen como no disponibles (`r2Ready()`). El bucket no debe tener acceso público ni dominio público. Los enlaces firmados se abren directamente en el navegador, así que el bucket no necesita reglas CORS.

## Errores específicos

| Código | Estado | Causa |
| --- | --- | --- |
| `MULTIPART_REQUIRED` / `MULTIPART_INVALID` / `FORM_INVALID` | 415 / 400 / 400 | Formulario mal formado o con campos de más |
| `FILE_REQUIRED` | 400 | No se envió archivo |
| `FILE_SIZE_INVALID` | 413 | Archivo vacío o mayor de 4 MiB |
| `FILE_NAME_INVALID` | 400 | Nombre vacío o demasiado largo |
| `FILE_TYPE_INVALID` / `FILE_CONTENT_INVALID` | 415 | Tipo no permitido, extensión distinta del MIME o contenido que no corresponde |
| `RELATED_RECORD_NOT_FOUND` | 422 | El expediente enlazado no existe |
| `DOCUMENT_NOT_FOUND` / `FILE_NOT_FOUND` | 404 | Fila inexistente o con clave no gestionada / objeto ausente en R2 |

## Pruebas

`tests/documents.test.ts` cubre:

- el rechazo de tipos y contenidos falsificados
- que no se escriba en R2 si el expediente no existe
- que las claves sean únicas
- la limpieza cuando falla PostgreSQL
- el rechazo de referencias heredadas
- el límite sin `Content-Length`
- la validación del endpoint R2 y la caducidad de 60 s del enlace firmado

```powershell
npx tsx --test tests/documents.test.ts
```

## Pendientes

- **Límite de 4 MiB:** se debe al cuerpo máximo de las funciones de Vercel (~4.5 MB). Para videos o archivos mayores, cambiar a carga directa con URL firmada de `PUT`, seguida de una confirmación en el servidor que verifique el objeto (tamaño y firma) antes de crear la fila.
- **Sin eliminación ni edición** de documentos. Al implementarlas, borrar el objeto de R2 de forma idempotente y auditar la operación.
- **Permisos por expediente:** hoy cualquier usuario autorizado puede listar y descargar todos los documentos. Falta restringir por cartera o rol cuando existan reglas de acceso por expediente.
- **Auditoría** de cargas y descargas (quién y cuándo).
- **Huérfanos:** falta un proceso que concilie objetos de R2 sin fila en `Document` (casos `R2_ORPHAN_CLEANUP_REQUIRED`).
- **Selector de expedientes:** solo muestra los 100 clientes, pólizas y siniestros más recientes. Falta búsqueda cuando la cartera crezca.
- **Antivirus y vista previa:** no se analizan archivos ni se generan miniaturas.
- **Respaldo y retención** del bucket aún sin definir.
