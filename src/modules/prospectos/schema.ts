import { z } from 'zod';
import { text, contact, id, ownerEmail } from '../shared/validation';
import {businessLines} from '../areas/policy';
const answer = z.string().trim().min(1).max(2000);
// CLIENTE is only reachable through the conversion flow (it links the new client), never typed in a form.
export const editableStatuses = ['CURIOSO', 'INFORMACION_RECIBIDA', 'DIAGNOSTICADO', 'PROPUESTA_ENVIADA', 'DOCUMENTACION', 'EMISION_SOLICITADA', 'INFORMACION_ADICIONAL', 'REENVIO_EMISION', 'FIRMA', 'EMITIDA', 'EMISION', 'PERDIDO', 'COMPARATIVO'] as const;
export const createSchema = z.object({
  ...contact, source: text.default('manual'), notes: z.string().max(5000).optional(),
  line:z.enum(businessLines).default('MEDICAL'), clientId:id.optional(),
  sex:z.enum(['FEMENINO','MASCULINO','NO_ESPECIFICADO']).optional(),
  age:z.union([z.number(),z.string().regex(/^\d{1,3}$/)]).transform(Number).pipe(z.number().int().min(0).max(120)).optional(),
  postalCode:z.string().regex(/^\d{5}$/,'Escribe un código postal de cinco dígitos.').optional(),
  vehicle:z.string().trim().min(1).max(1000).optional(),
  paymentFrequency:z.enum(['ONCE','MONTHLY','QUARTERLY','SEMIANNUAL','ANNUAL']).optional(),
  paymentMethod:z.enum(['TARJETA','TRANSFERENCIA','DOMICILIACION','EFECTIVO','POR_DEFINIR']).optional(),
  status: z.enum(editableStatuses).default('CURIOSO'), ownerEmail: ownerEmail.optional(), referredByClientId: id.optional(),
  diagProtect: answer.optional(), diagDependents: answer.optional(), diagCare: answer.optional(), diagCoverage: answer.optional(),
  diagMedicalHistory: z.enum(['SI', 'NO', 'NO_SABE']).optional(), diagPain: z.enum(['PRIMA', 'DECIDIR', 'AMBAS']).optional(),
}).strict();
// Edits of an already converted prospect keep CLIENTE; the server checks it really was converted.
export const updateSchema = createSchema.extend({ status: z.enum([...editableStatuses, 'CLIENTE']) });
