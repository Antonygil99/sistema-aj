import { z } from 'zod';
import { id, date } from '../shared/validation';
export const createSchema = z.object({ policyId: id, dueDate: date, status: z.enum(['PENDING','CONTACTED','RENEWED','LOST']).default('PENDING'), notes: z.string().max(5000).optional() }).strict();
