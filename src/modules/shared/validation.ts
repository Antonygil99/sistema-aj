import { z } from 'zod';
export const text = z.string().trim().min(1).max(250);
export const id = z.string().min(1).max(100);
export const date = z.iso.datetime({ offset: true }).transform(value => new Date(value));
export const money = z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, 'Usar importe decimal como texto, por ejemplo 1250.00');
export const currency = z.string().regex(/^[A-Z]{3}$/).default('MXN');
export const contact = { name: text, email: z.email().optional(), phone: z.string().regex(/^\+?[1-9]\d{7,14}$/).optional() };
