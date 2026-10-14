// Request body for PATCH /api/policies/[id]/delivery. Kept apart from delivery.ts so the board (browser) does not ship zod.
import { z } from 'zod';
import { checklist, followUps, type ChecklistField, type FollowUpKind } from './delivery';
export const deliveryInput = z.object({
  expectedUpdatedAt: z.iso.datetime({ offset: true }),
  deliveredAt: z.iso.date().nullable(),
  referralPotential: z.boolean(),
  checks: z.object(Object.fromEntries(checklist.map(item => [item.field, z.boolean()])) as Record<ChecklistField, z.ZodBoolean>).strict(),
  followUps: z.object(Object.fromEntries(followUps.map(item => [item.kind, z.boolean()])) as Record<FollowUpKind, z.ZodBoolean>).partial().strict().default({}),
}).strict().superRefine((value, ctx) => {
  if (!value.deliveredAt && (Object.values(value.checks).some(Boolean) || value.referralPotential)) ctx.addIssue({ code: 'custom', message: 'Primero registra la fecha de entrega.' });
});
