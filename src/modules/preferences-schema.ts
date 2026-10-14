import { z } from 'zod';
import { MAX_SEEN, REMINDER_KEY, TOUR_ID, modelIds, themeOptions, viewOptions, type PreferencesPatch } from './preferences';
// Strict validation of PATCH /api/preferences bodies: unknown keys or values are rejected. Server and tests only,
// so zod never reaches the browser bundle.
export const preferencesPatch: z.ZodType<PreferencesPatch> = z.object({
  views: z.object({ clientes: z.enum(viewOptions.clientes), documentos: z.enum(viewOptions.documentos), prospectos: z.enum(viewOptions.prospectos) }).partial().strict().optional(),
  resetViews: z.literal(true).optional(),
  tours: z.object({ enabled: z.boolean().optional(), seen: z.array(z.string().regex(TOUR_ID)).max(MAX_SEEN).optional() }).strict().optional(),
  theme: z.enum(themeOptions).optional(),
  notifications: z.object({ team: z.boolean(), toasts: z.boolean(), payments: z.boolean(), renewals: z.boolean(), followUps: z.boolean(), emailProspects: z.boolean(), emailClaims: z.boolean(), emailAgenda: z.boolean(), clearedAt: z.iso.datetime({ offset: true }).nullable(), clearedReminders: z.string().regex(REMINDER_KEY).nullable() }).partial().strict().optional(),
  assistantModel: z.enum(modelIds).optional(),
}).strict();
