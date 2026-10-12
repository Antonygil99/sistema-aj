import { z } from 'zod';
import { text, contact } from '../shared/validation';
export const createSchema = z.object({ ...contact, source: text.default('manual'), notes: z.string().max(5000).optional(), status: z.enum(['NEW','CONTACTED','QUALIFIED','WON','LOST']).default('NEW') }).strict();
