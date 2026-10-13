import { z } from 'zod';
import { createSchema as clientSchema } from './schema';
export const frequencies = { ONCE: 'Pago único', MONTHLY: 'Mensual', QUARTERLY: 'Trimestral', SEMIANNUAL: 'Semestral', ANNUAL: 'Anual' } as const;
const day = z.iso.date();
const amount = z.number().positive().max(9999999999.99).refine(n => Math.abs(n * 100 - Math.round(n * 100)) < .001, 'Máximo dos decimales');
export const policyInput = z.object({
  number: z.string().trim().min(1).max(250), insurer: z.string().trim().min(1).max(250), product: z.string().trim().min(1).max(250),
  premium: amount, currency: z.enum(['MXN','USD']), startDate: day, endDate: day,
  paymentFrequency: z.enum(['ONCE','MONTHLY','QUARTERLY','SEMIANNUAL','ANNUAL']),
  payments: z.array(z.object({ amount, dueDate: day }).strict()).min(1).max(120),
}).strict().superRefine((p, ctx) => {
  if (p.endDate <= p.startDate) ctx.addIssue({ code: 'custom', message: 'Revisa la vigencia' });
  if (p.paymentFrequency === 'ONCE' && p.payments.length !== 1) ctx.addIssue({ code: 'custom', message: 'El pago único requiere un recibo' });
  if (p.payments.reduce((sum, row) => sum + Math.round(row.amount * 100), 0) !== Math.round(p.premium * 100)) ctx.addIssue({ code: 'custom', message: 'Los recibos deben sumar la prima total' });
  p.payments.forEach((row, i) => { if (row.dueDate < p.startDate || row.dueDate > p.endDate || (i > 0 && row.dueDate <= p.payments[i-1].dueDate)) ctx.addIssue({ code: 'custom', message: 'Vencimientos ordenados dentro de la vigencia' }); });
});
export const dossierInput = z.object({ client: clientSchema, policy: policyInput.optional() }).strict();
const clientMessages: Record<string, string> = { name: 'Escribe el nombre del cliente.', email: 'Revisa el correo electrónico.', phone: 'Teléfono: de 8 a 15 dígitos, sin espacios; puede iniciar con +.', taxId: 'Revisa el RFC.' };
// Spanish, field-specific feedback for the first wizard step; Zod's defaults are English.
export function clientIssues(input: unknown) {
  const result = clientSchema.safeParse(input);
  return result.success ? [] : [...new Set(result.error.issues.map(issue => clientMessages[String(issue.path[0])] ?? 'Revisa los datos del cliente.'))];
}
export function makeSchedule(total: number, count: number, first: string, frequency: keyof typeof frequencies) {
  if (!Number.isFinite(total) || total <= 0 || !Number.isInteger(count) || count < 1 || count > 120 || !/^\d{4}-\d{2}-\d{2}$/.test(first)) return [];
  const cents = Math.round(total * 100), months = { ONCE: 0, MONTHLY: 1, QUARTERLY: 3, SEMIANNUAL: 6, ANNUAL: 12 }[frequency];
  const base = new Date(first + 'T00:00:00Z');
  return Array.from({ length: count }, (_, i) => { const date = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + months * i, 1)); const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate(); date.setUTCDate(Math.min(base.getUTCDate(), last)); return { amount: (Math.floor(cents / count) + (i === count-1 ? cents % count : 0)) / 100, dueDate: date.toISOString().slice(0,10) }; });
}
export function coverageState(policies: { status: string; startDate: string | Date; endDate: string | Date }[], today = new Date().toISOString().slice(0,10)) {
  const dayOf = (v: string | Date) => new Date(v).toISOString().slice(0,10);
  if (policies.some(p => p.status === 'ACTIVE' && dayOf(p.startDate) <= today && dayOf(p.endDate) >= today)) return 'Activo';
  if (policies.some(p => p.status === 'ACTIVE' && dayOf(p.startDate) > today)) return 'Próxima vigencia';
  return policies.length ? 'Sin póliza vigente' : 'Por completar';
}
