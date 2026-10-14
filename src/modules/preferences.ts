// Per-user UI preferences: views, guided tours, theme, notifications and the assistants' model. Pure and free of
// zod, because the browser loads it on every screen; the API validates patches with preferences-schema.ts
// (both unit tested in tests/preferences.test.ts).
export const viewOptions = {
  clientes: ['dossiers', 'list'],
  documentos: ['grid', 'list'],
  prospectos: ['board', 'list'],
} as const;
export const themeOptions = ['light', 'dark', 'system', 'gradient'] as const;
// Current Claude models for the future assistants; nothing calls them yet (see docs/arquitectura.md).
export const assistantModels = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', summary: 'Recomendado: el más completo para el trabajo diario del equipo.' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', summary: 'Equilibrado: rápido y capaz para tareas frecuentes.' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5', summary: 'El más rápido y económico, para respuestas breves.' },
  { id: 'claude-fable-5-1', label: 'Claude Fable 5.1', summary: 'El más capaz, para casos complejos; más lento y de mayor costo.' },
] as const;
export type ViewKey = keyof typeof viewOptions;
export type ViewValue<K extends ViewKey> = (typeof viewOptions)[K][number];
export type Theme = (typeof themeOptions)[number];
export type AssistantModel = (typeof assistantModels)[number]['id'];
export type NotificationSettings = { team: boolean; toasts: boolean; payments: boolean; renewals: boolean; followUps: boolean; clearedAt: string | null; clearedReminders: string | null };
export type Preferences = { views: { [K in ViewKey]?: ViewValue<K> }; tours: { enabled: boolean; seen: string[] }; theme: Theme; notifications: NotificationSettings; assistantModel: AssistantModel };
export type PreferencesPatch = {
  views?: Preferences['views'];
  resetViews?: true;
  tours?: { enabled?: boolean; seen?: string[] };
  theme?: Theme;
  notifications?: Partial<NotificationSettings>;
  assistantModel?: AssistantModel;
};
const defaultNotifications: NotificationSettings = { team: true, toasts: true, payments: true, renewals: true, followUps: true, clearedAt: null, clearedReminders: null };
export const defaultPreferences: Preferences = { views: {}, tours: { enabled: false, seen: [] }, theme: 'light', notifications: defaultNotifications, assistantModel: 'claude-opus-5-5' };
export const MAX_SEEN = 100;
export const TOUR_ID = /^[a-z0-9:-]{1,60}$/;
export const REMINDER_KEY = /^[0-9:-]{1,60}$/;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
export const isTimestamp = (value: unknown): value is string => typeof value === 'string' && TIMESTAMP.test(value) && !Number.isNaN(Date.parse(value));
export const modelIds = assistantModels.map(model => model.id) as [AssistantModel, ...AssistantModel[]];
export function isViewKey(value: string): value is ViewKey { return Object.hasOwn(viewOptions, value); }
const record = (value: unknown) => typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
// Stored JSON may be old or hand-edited: keep each value that is still valid instead of discarding everything.
export function readPreferences(stored: unknown): Preferences {
  const value = record(stored);
  const rawViews = record(value.views);
  const views: Record<string, string> = {};
  for (const key of Object.keys(viewOptions) as ViewKey[]) {
    const choice = rawViews[key];
    if (typeof choice === 'string' && (viewOptions[key] as readonly string[]).includes(choice)) views[key] = choice;
  }
  const tours = record(value.tours);
  const seen = Array.isArray(tours.seen) ? tours.seen.filter((item): item is string => typeof item === 'string' && TOUR_ID.test(item)) : [];
  const rawNotifications = record(value.notifications);
  const notifications = { ...defaultNotifications };
  for (const key of ['team', 'toasts', 'payments', 'renewals', 'followUps'] as const) if (typeof rawNotifications[key] === 'boolean') notifications[key] = rawNotifications[key] as boolean;
  if (isTimestamp(rawNotifications.clearedAt)) notifications.clearedAt = rawNotifications.clearedAt;
  if (typeof rawNotifications.clearedReminders === 'string' && REMINDER_KEY.test(rawNotifications.clearedReminders)) notifications.clearedReminders = rawNotifications.clearedReminders;
  return {
    views: views as Preferences['views'],
    tours: { enabled: tours.enabled === true, seen: [...new Set(seen)].slice(-MAX_SEEN) },
    theme: (themeOptions as readonly unknown[]).includes(value.theme) ? value.theme as Theme : defaultPreferences.theme,
    notifications,
    assistantModel: (modelIds as readonly unknown[]).includes(value.assistantModel) ? value.assistantModel as AssistantModel : defaultPreferences.assistantModel,
  };
}
export function mergePreferences(current: Preferences, patch: PreferencesPatch): Preferences {
  return {
    views: patch.resetViews ? { ...patch.views } : { ...current.views, ...patch.views },
    tours: {
      enabled: patch.tours?.enabled ?? current.tours.enabled,
      seen: patch.tours?.seen ? [...new Set(patch.tours.seen)].slice(-MAX_SEEN) : current.tours.seen,
    },
    theme: patch.theme ?? current.theme,
    notifications: { ...current.notifications, ...patch.notifications },
    assistantModel: patch.assistantModel ?? current.assistantModel,
  };
}
