import { z } from 'zod';
import { text, id } from '../shared/validation';
export const createSchema = z.object({ name: text, storageKey: text, mimeType: text, clientId: id.optional(), policyId: id.optional(), claimId: id.optional() }).strict().refine(d => [d.clientId,d.policyId,d.claimId].filter(Boolean).length === 1, { message: 'Asignar el documento a un único expediente' });
