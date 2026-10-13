import { z } from 'zod';
import { text, contact, id, ownerEmail } from '../shared/validation';
const answer = z.string().trim().min(1).max(2000);
// CLIENTE is only reachable through the conversion flow (it links the new client), never typed in a form.
export const editableStatuses = ['CURIOSO', 'DIAGNOSTICADO', 'COMPARATIVO', 'EMISION', 'PERDIDO'] as const;
export const createSchema = z.object({
  ...contact, source: text.default('manual'), notes: z.string().max(5000).optional(),
  status: z.enum(editableStatuses).default('CURIOSO'), ownerEmail: ownerEmail.optional(), referredByClientId: id.optional(),
  diagProtect: answer.optional(), diagDependents: answer.optional(), diagCare: answer.optional(), diagCoverage: answer.optional(),
  diagMedicalHistory: z.enum(['SI', 'NO', 'NO_SABE']).optional(), diagPain: z.enum(['PRIMA', 'DECIDIR', 'AMBAS']).optional(),
}).strict();
// Edits of an already converted prospect keep CLIENTE; the server checks it really was converted.
export const updateSchema = createSchema.extend({ status: z.enum([...editableStatuses, 'CLIENTE']) });
