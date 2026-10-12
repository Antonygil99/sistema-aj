import { z } from 'zod';
import { text, contact } from '../shared/validation';
export const createSchema = z.object({ ...contact, taxId: text.optional() }).strict();
