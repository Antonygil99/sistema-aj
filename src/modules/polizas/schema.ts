import { z } from 'zod';
import { text, id, date, money, currency } from '../shared/validation';
export const createSchema = z.object({ number: text, clientId: id, insurer: text, product: text, premium: money, currency, paymentFrequency: z.enum(['ONCE','MONTHLY','QUARTERLY','SEMIANNUAL','ANNUAL']).optional(), startDate: date, endDate: date, status: z.enum(['ACTIVE','EXPIRED','CANCELLED']).default('ACTIVE') }).strict().refine(d => d.endDate > d.startDate, { message: 'La fecha final debe ser posterior al inicio' });
