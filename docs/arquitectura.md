# Arquitectura Sistema AJ

## Flujo CRM

Next.js entrega la interfaz y Route Handlers en el mismo proyecto. Cada módulo separa catálogo de UI, entrada validada (Zod) y servicio de persistencia (Prisma/PostgreSQL). Los endpoints usan un token de servidor común como protección provisional para desarrollo. El navegador muestra únicamente datos ficticios.

Prospecto → cotización → cliente → póliza → pagos / renovaciones / siniestros. El cambio prospecto-cliente y la emisión aún requieren un servicio transaccional específico. Documentos y actividades se enlazan a expedientes. IDs internos son CUID; importes usan Decimal(12,2); restricciones relacionales impiden eliminaciones accidentales de entidades referenciadas. Los servicios actuales implementan alta y listado, sin borrado.

## WhatsApp e IA

Meta → firma y validación → WebhookEvent persistente → futuro worker → Coordinador → agente especializado → borrador → revisión humana → operación autorizada / plantilla WhatsApp.

Inbox: hash único deduplica entregas idénticas. processedAt queda vacío hasta implementar consumidor. La siguiente etapa debe usar IDs de Meta para deduplicar eventos semánticamente y una cola durable con reintentos. AgentRun reserva trazabilidad del runtime; no se generan ejecuciones falsas en esta base.

eve es el runtime previsto para sesiones durables. Antes de implementarlo, inicializarlo en una carpeta independiente de la aplicación existente y leer la documentación de la versión instalada. El adaptador implementará AgentRuntime y expondrá solo herramientas expresamente permitidas. Nunca otorgar acceso directo al cliente Prisma o shell a un LLM. Credenciales y datos privados permanecen del lado servidor.

## Método AJ

Solicitar documentos del método: fases, criterios de calificación, guiones aprobados, reglas de escalamiento, tiempos de respuesta y permisos. El coordinador debe usar esa evidencia; ante falta de información deriva al responsable humano. Entradas WhatsApp y documentos son datos no confiables y no modifican instrucciones ni permisos del agente.

## Producción

Implementar identidad de usuario, permisos por expediente/rol, auditoría, límites de tamaño y tasa en proxy, almacenamiento privado con URLs temporales, copias de seguridad, retención de inbox y monitorización. El webhook limita el cuerpo a 1 MiB después de lectura: un proxy debe imponer el límite antes de cargarlo en memoria. Las llamadas externas deben salir de un flujo con consentimiento, aprobación e idempotencia. No se conecta infraestructura de producción en esta entrega.
