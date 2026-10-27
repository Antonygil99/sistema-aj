import { z } from 'zod';
import { makeSchedule, frequencies } from '../clientes/dossier-policy';
export { makeSchedule, frequencies };
const amount = z.number().positive().max(9999999999.99).refine(n => Math.abs(n * 100 - Math.round(n * 100)) < .001, 'Usa dos decimales');
const version = z.iso.datetime({ offset: true });
export const scheduleInput = z.object({ expectedUpdatedAt: version, paymentFrequency: z.enum(['ONCE','MONTHLY','QUARTERLY','SEMIANNUAL','ANNUAL']),
  payments: z.array(z.object({ amount, dueDate: z.iso.date() }).strict()).min(1).max(120), reviewed: z.literal(true) }).strict();
export function scheduleIssues(policy: { premium: number; startDate: string; endDate: string }, rows: { amount: number; dueDate: string }[], frequency: string) {
  if (!rows.length || rows.length > 120) return 'Registra entre 1 y 120 recibos.';
  if (frequency === 'ONCE' && rows.length !== 1) return 'El pago único requiere un solo recibo.';
  if (rows.some(row => !Number.isFinite(row.amount) || row.amount <= 0 || Math.abs(row.amount*100 - Math.round(row.amount*100)) > .001)) return 'Cada recibo requiere un importe positivo de dos decimales.';
  if (Math.round(policy.premium*100) !== rows.reduce((sum,row) => sum + Math.round(row.amount*100),0)) return 'Los recibos deben sumar exactamente la prima total.';
  if (rows.some((row,i) => !z.iso.date().safeParse(row.dueDate).success || row.dueDate < policy.startDate || row.dueDate > policy.endDate || (i > 0 && row.dueDate <= rows[i-1].dueDate))) return 'Los vencimientos deben estar ordenados y dentro de la vigencia.';
  return null;
}
export const confirmationInput = z.object({ expectedUpdatedAt: version, paidAt: z.iso.date(), reference: z.string().trim().min(1).max(250), evidenceDocumentId: z.string().min(1).max(100), reviewed: z.literal(true) }).strict();
export const renewalInput = z.object({ expectedUpdatedAt: version, number: z.string().trim().min(1).max(250), premium: amount,
  startDate: z.iso.date(), endDate: z.iso.date(), reviewed: z.literal(true) }).strict().refine(input => input.endDate > input.startDate, 'Revisa las fechas de la nueva vigencia');
export const policyDay = (date: Date) => date.toISOString().slice(0,10);
