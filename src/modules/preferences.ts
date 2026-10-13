import { z } from 'zod';
// Per-user UI preferences: the view chosen in each module and the guided-tour state. Pure, shared by the
// API, the server pages and the browser (unit tested in tests/preferences.test.ts).
export const viewOptions = {
  clientes: ['dossiers', 'list'],
  documentos: ['grid', 'list'],
  prospectos: ['board', 'list'],
} as const;
export type ViewKey = keyof typeof viewOptions;
export type ViewValue<K extends ViewKey> = (typeof viewOptions)[K][number];
export type Preferences = { views: { [K in ViewKey]?: ViewValue<K> }; tours: { enabled: boolean; seen: string[] } };
export const defaultPreferences: Preferences = { views: {}, tours: { enabled: false, seen: [] } };
const MAX_SEEN = 100;
const tourId = z.string().regex(/^[a-z0-9:-]{1,60}$/);
export const preferencesPatch = z.object({
  views: z.object({ clientes: z.enum(viewOptions.clientes), documentos: z.enum(viewOptions.documentos), prospectos: z.enum(viewOptions.prospectos) }).partial().strict().optional(),
  tours: z.object({ enabled: z.boolean().optional(), seen: z.array(tourId).max(MAX_SEEN).optional() }).strict().optional(),
}).strict();
export type PreferencesPatch = z.infer<typeof preferencesPatch>;
export function isViewKey(value: string): value is ViewKey { return Object.hasOwn(viewOptions, value); }
// Stored JSON may be old or hand-edited: keep each value that is still valid instead of discarding everything.
export function readPreferences(stored: unknown): Preferences {
  const value = typeof stored === 'object' && stored !== null ? stored as Record<string, unknown> : {};
  const rawViews = typeof value.views === 'object' && value.views !== null ? value.views as Record<string, unknown> : {};
  const views: Record<string, string> = {};
  for (const key of Object.keys(viewOptions) as ViewKey[]) {
    const choice = rawViews[key];
    if (typeof choice === 'string' && (viewOptions[key] as readonly string[]).includes(choice)) views[key] = choice;
  }
  const tours = typeof value.tours === 'object' && value.tours !== null ? value.tours as Record<string, unknown> : {};
  const seen = Array.isArray(tours.seen) ? tours.seen.filter((item): item is string => tourId.safeParse(item).success) : [];
  return { views: views as Preferences['views'], tours: { enabled: tours.enabled === true, seen: [...new Set(seen)].slice(-MAX_SEEN) } };
}
export function mergePreferences(current: Preferences, patch: PreferencesPatch): Preferences {
  return {
    views: { ...current.views, ...patch.views },
    tours: {
      enabled: patch.tours?.enabled ?? current.tours.enabled,
      seen: patch.tours?.seen ? [...new Set(patch.tours.seen)].slice(-MAX_SEEN) : current.tours.seen,
    },
  };
}
