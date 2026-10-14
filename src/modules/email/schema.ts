// Request bodies for the email routes (server and tests only, so zod stays out of the browser).
import { z } from 'zod';
import { MAX_ATTACHMENTS, MAX_RECIPIENTS } from './rules';
const id = z.string().min(1).max(100);
export const composeInput = z.object({
  requestId: z.uuid(),
  kind: z.enum(['DOCUMENTOS', 'BIENVENIDA']),
  clientId: id,
  to: z.array(z.email().max(254)).min(1, 'Elige al menos un destinatario.').max(MAX_RECIPIENTS),
  subject: z.string().trim().min(1, 'Escribe el asunto.').max(200),
  message: z.string().trim().min(1, 'Escribe el mensaje.').max(10000),
  documentIds: z.array(id).max(MAX_ATTACHMENTS, `Adjunta hasta ${MAX_ATTACHMENTS} archivos.`).default([]).transform(ids => [...new Set(ids)]),
}).strict();
export type ComposeInput = z.infer<typeof composeInput>;
const optional = (schema: z.ZodType<string>) => z.union([schema, z.literal('')]).nullable().optional().transform(value => value ? value : null);
export const contactInput = z.object({
  name: z.string().trim().min(1, 'Escribe el nombre.').max(120),
  email: optional(z.string().trim().toLowerCase().pipe(z.email('Revisa el correo electrónico.').max(254))),
  phone: optional(z.string().trim().regex(/^\+?\d{8,15}$/, 'Teléfono: de 8 a 15 dígitos, sin espacios; puede iniciar con +.')),
  role: z.string().trim().max(60).default(''),
}).strict().refine(value => value.email || value.phone, { message: 'Registra al menos un correo o un teléfono.', path: ['email'] });
export type ContactInput = z.infer<typeof contactInput>;
