import { z } from 'zod';
import { text, id, date } from '../shared/validation';
export const createSchema = z.object({ title: text, description: z.string().max(5000).optional(), dueDate: date.optional(), status: z.enum(['PENDING','DONE']).default('PENDING'), prospectId: id.optional(), clientId: id.optional(), policyId: id.optional(), claimId: id.optional() }).strict().refine(d => [d.prospectId,d.clientId,d.policyId,d.claimId].filter(Boolean).length <= 1, { message: 'Asignar como máximo a un expediente' });
