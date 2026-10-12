import { z } from 'zod';
import { text, id, date } from '../shared/validation';
export const createSchema = z.object({ reference: text, policyId: id, description: z.string().min(1).max(5000), occurredAt: date, status: z.enum(['OPEN','IN_REVIEW','CLOSED']).default('OPEN') }).strict();
