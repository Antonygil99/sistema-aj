// Active policy delivery (Ruta de implementación AJ v1, etapas 5–7). Pure and unit tested.
import { z } from 'zod';
// "Una póliza emitida no se considera terminada cuando se envía el PDF": these five checks complete it.
export const checklist = [
  { field: 'deliveryReceived', label: 'Recibió la póliza' },
  { field: 'deliveryUnderstood', label: 'Entendió cómo usarla' },
  { field: 'deliveryKnowsContact', label: 'Sabe a quién acudir' },
  { field: 'deliveryKnowsWhenToNotify', label: 'Sabe cuándo avisar a su asesor' },
  { field: 'deliveryKnowsFirstStep', label: 'Tiene claro el primer paso ante una consulta o urgencia' },
] as const;
export type ChecklistField = typeof checklist[number]['field'];
export const followUps = [
  { kind: 'SEGUIMIENTO_7', days: 7, label: 'Seguimiento de uso · 7 días' },
  { kind: 'SEGUIMIENTO_30', days: 30, label: 'Seguimiento de uso · 30 días' },
  { kind: 'SEGUIMIENTO_90', days: 90, label: 'Seguimiento de uso · 90 días' },
] as const;
export type FollowUpKind = typeof followUps[number]['kind'];
export const isFollowUpKind = (value: unknown): value is FollowUpKind => followUps.some(item => item.kind === value);
// Board columns from the client's day-6 sprint: emitida → entregada → explicada → 7 días → 30 días → posible referido.
export const stages = [
  { id: 'EMITIDA', label: 'Emitida', hint: 'Lista para entregar', message: 'Mientras más clara salga la información desde el inicio, mejor se protege tu póliza.' },
  { id: 'ENTREGADA', label: 'Entregada', hint: 'Falta explicarla', message: 'La póliza ya existe; ahora vamos a convertirla en una herramienta que sabes usar.' },
  { id: 'EXPLICADA', label: 'Explicada', hint: 'Póliza completada', message: 'Antes de necesitarla, asegúrate de saber cómo usarla.' },
  { id: 'SEGUIMIENTO_7', label: 'Seguimiento 7 días', hint: 'Primera revisión hecha', message: 'Antes de necesitarla, asegúrate de saber cómo usarla.' },
  { id: 'SEGUIMIENTO_30', label: 'Seguimiento 30 días', hint: 'Confianza construida', message: 'Si conoces a alguien que también quiera entender y usar bien su seguro, puedes compartirle mi contacto.' },
  { id: 'REFERIDO', label: 'Posible referido', hint: 'Cliente recomendador', message: 'Si conoces a alguien que también quiera entender y usar bien su seguro, puedes compartirle mi contacto.' },
] as const;
export type StageId = typeof stages[number]['id'];
export type DeliveryState = { deliveredAt: string | Date | null; referralPotential: boolean } & Record<ChecklistField, boolean>;
export type FollowUpState = { kind: string | null; status: string; dueDate: string | Date | null };
export const isComplete = (policy: DeliveryState) => checklist.every(item => policy[item.field]);
export const completedChecks = (policy: DeliveryState) => checklist.filter(item => policy[item.field]).length;
const done = (items: FollowUpState[], kind: FollowUpKind) => items.some(item => item.kind === kind && item.status === 'DONE');
export function deliveryStage(policy: DeliveryState, items: FollowUpState[]): StageId {
  if (!policy.deliveredAt) return 'EMITIDA';
  if (!isComplete(policy)) return 'ENTREGADA';
  if (!done(items, 'SEGUIMIENTO_7')) return 'EXPLICADA';
  if (!done(items, 'SEGUIMIENTO_30')) return 'SEGUIMIENTO_7';
  return policy.referralPotential ? 'REFERIDO' : 'SEGUIMIENTO_30';
}
const day = (value: string | Date) => new Date(value).toISOString().slice(0, 10);
// Follow-ups fall on calendar days counted from the delivery date (UTC midnight, like every CRM date).
export function followUpSchedule(deliveredAt: string | Date) {
  const base = new Date(day(deliveredAt) + 'T00:00:00.000Z');
  return followUps.map(item => ({ ...item, dueDate: new Date(base.getTime() + item.days * 86400000) }));
}
// The next pending follow-up, flagged when its date already passed.
export function nextFollowUp(items: FollowUpState[], today = new Date().toISOString().slice(0, 10)) {
  const pending = followUps.map(item => ({ ...item, activity: items.find(activity => activity.kind === item.kind) }))
    .find(item => item.activity && item.activity.status !== 'DONE' && item.activity.dueDate);
  if (!pending?.activity?.dueDate) return null;
  const due = day(pending.activity.dueDate);
  return { kind: pending.kind, label: pending.label, dueDate: due, overdue: due < today };
}
// What the delivery board shows for each policy (plain JSON, safe for the browser).
export type DeliveryCard = {
  id: string; number: string; product: string; insurer: string; updatedAt: string; ownerEmail: string | null;
  client: { id: string; name: string }; catalogProduct: { id: string; name: string; image: string | null } | null;
  deliveredAt: string | null; referralPotential: boolean; checks: Record<ChecklistField, boolean>;
  followUps: { id: string; kind: FollowUpKind; status: string; dueDate: string | null }[];
  stage: StageId; completed: boolean; next: ReturnType<typeof nextFollowUp>;
};
export const deliveryInput = z.object({
  expectedUpdatedAt: z.iso.datetime({ offset: true }),
  deliveredAt: z.iso.date().nullable(),
  referralPotential: z.boolean(),
  checks: z.object(Object.fromEntries(checklist.map(item => [item.field, z.boolean()])) as Record<ChecklistField, z.ZodBoolean>).strict(),
  followUps: z.object(Object.fromEntries(followUps.map(item => [item.kind, z.boolean()])) as Record<FollowUpKind, z.ZodBoolean>).partial().strict().default({}),
}).strict().superRefine((value, ctx) => {
  if (!value.deliveredAt && (Object.values(value.checks).some(Boolean) || value.referralPotential)) ctx.addIssue({ code: 'custom', message: 'Primero registra la fecha de entrega.' });
});
