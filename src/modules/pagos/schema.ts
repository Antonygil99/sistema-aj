import { z } from 'zod';
import { id, date, money, currency } from '../shared/validation';
export const createSchema = z.object({ policyId: id, amount: money, currency, dueDate: date, paidAt: date.optional(), status: z.enum(['PENDING','PAID','OVERDUE']).default('PENDING') }).strict().refine(d => (d.status === 'PAID') === Boolean(d.paidAt), { message: 'paidAt es obligatorio únicamente para pagos PAID' });
