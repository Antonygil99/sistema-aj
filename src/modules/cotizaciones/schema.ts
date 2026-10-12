import { z } from 'zod';
import { text, id, date, money, currency } from '../shared/validation';
export const createSchema = z.object({ reference: text, prospectId: id.optional(), clientId: id.optional(), product: text, amount: money, currency, status: z.enum(['DRAFT','SENT','ACCEPTED','REJECTED']).default('DRAFT'), validUntil: date.optional() }).strict().refine(d => Boolean(d.prospectId) !== Boolean(d.clientId), { message: 'Indicar un prospecto o un cliente, exclusivamente' });
