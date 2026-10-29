// Per-user UI preferences: views, guided tours, theme, notifications and the assistants' model. Pure and free of
// zod, because the browser loads it on every screen; the API validates patches with preferences-schema.ts
// (both unit tested in tests/preferences.test.ts).
export const viewOptions = {
  clientes: ['dossiers', 'list'],
  documentos: ['grid', 'list'],
  prospectos: ['board', 'list'],
} as const;
export const themeOptions = ['light', 'dark', 'system', 'gradient'] as const;
// Models the assistants can use (src/agents/server.ts reads the user's choice): light and inexpensive ones only,
// from Anthropic and OpenAI. A stored choice that is no longer listed falls back to the default on read.
export const assistantModels = [
  { id: 'claude-haiku-5-5', provider: 'anthropic', label: 'Claude Haiku 5.5', summary: 'Recomendado: el más rápido y económico. Suficiente para consultas, avisos y borradores.' },
  { id: 'claude-sonnet-5-5', provider: 'anthropic', label: 'Claude Sonnet 5.5', summary: 'Más capaz para análisis y redacción largos; cada respuesta cuesta unas 20 veces más.' },
  { id: 'gpt-6-luna', provider: 'openai', label: 'GPT-6 Luna', summary: 'El más eficiente de OpenAI; costo similar a Haiku.' },
  { id: 'gpt-6.1-sol', provider: 'openai', label: 'GPT-6.1 Sol', summary: 'OpenAI, más capaz; costo similar a Sonnet.' },
] as const;
export type AssistantProvider = (typeof assistantModels)[number]['provider'];
export const providerLabels: Record<AssistantProvider, string> = { anthropic: 'Anthropic', openai: 'OpenAI' };
export type ViewKey = keyof typeof viewOptions;
export type ViewValue<K extends ViewKey> = (typeof viewOptions)[K][number];
export type Theme = (typeof themeOptions)[number];
export type AssistantModel = (typeof assistantModels)[number]['id'];
// emailProspects / emailClaims / emailAgenda / emailDigest: automatic emails (src/modules/email) for new records,
// meetings and the morning summary.
export type NotificationSettings = { team: boolean; toasts: boolean; payments: boolean; renewals: boolean; followUps: boolean; emailProspects: boolean; emailClaims: boolean; emailAgenda: boolean; emailDigest: boolean; clearedAt: string | null; clearedReminders: string | null };
export const notificationSwitches = ['team', 'toasts', 'payments', 'renewals', 'followUps', 'emailProspects', 'emailClaims', 'emailAgenda', 'emailDigest'] as const;
export type NoticeSchedule={renewal:number[];payment:number[];claimEveryDays:number};
export const defaultNoticeSchedule:NoticeSchedule={renewal:[30,20,10],payment:[20,10,0],claimEveryDays:7};
export type Preferences = {noticeSchedule:NoticeSchedule; renewalDays:number[]; views: { [K in ViewKey]?: ViewValue<K> }; tours: { enabled: boolean; seen: string[] }; theme: Theme; notifications: NotificationSettings; assistantModel: AssistantModel };
export type PreferencesPatch = {
  noticeSchedule?:NoticeSchedule;
  renewalDays?:number[];
  views?: Preferences['views'];
  resetViews?: true;
  tours?: { enabled?: boolean; seen?: string[] };
  theme?: Theme;
  notifications?: Partial<NotificationSettings>;
  assistantModel?: AssistantModel;
};
const defaultNotifications: NotificationSettings = { team: true, toasts: true, payments: true, renewals: true, followUps: true, emailProspects: true, emailClaims: true, emailAgenda: true, emailDigest: true, clearedAt: null, clearedReminders: null };
export const defaultPreferences: Preferences = {noticeSchedule:defaultNoticeSchedule, renewalDays:[60,45,30], views: {}, tours: { enabled: false, seen: [] }, theme: 'light', notifications: defaultNotifications, assistantModel: 'claude-haiku-5-5' };
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
  for (const key of notificationSwitches) if (typeof rawNotifications[key] === 'boolean') notifications[key] = rawNotifications[key] as boolean;
  if (isTimestamp(rawNotifications.clearedAt)) notifications.clearedAt = rawNotifications.clearedAt;
  if (typeof rawNotifications.clearedReminders === 'string' && REMINDER_KEY.test(rawNotifications.clearedReminders)) notifications.clearedReminders = rawNotifications.clearedReminders;
  return {
    noticeSchedule:validNoticeSchedule(value.noticeSchedule)?{renewal:[...value.noticeSchedule.renewal].sort((a,b)=>b-a),payment:[...value.noticeSchedule.payment].sort((a,b)=>b-a),claimEveryDays:value.noticeSchedule.claimEveryDays}:defaultNoticeSchedule,
    renewalDays:validRenewalDays(value.renewalDays)?[...value.renewalDays].sort((a,b)=>b-a):[60,45,30],
    views: views as Preferences['views'],
    tours: { enabled: tours.enabled === true, seen: [...new Set(seen)].slice(-MAX_SEEN) },
    theme: (themeOptions as readonly unknown[]).includes(value.theme) ? value.theme as Theme : defaultPreferences.theme,
    notifications,
    assistantModel: (modelIds as readonly unknown[]).includes(value.assistantModel) ? value.assistantModel as AssistantModel : defaultPreferences.assistantModel,
  };
}
export function mergePreferences(current: Preferences, patch: PreferencesPatch): Preferences {
  return {
    noticeSchedule:patch.noticeSchedule??current.noticeSchedule,
    renewalDays:patch.renewalDays?[...patch.renewalDays].sort((a,b)=>b-a):current.renewalDays,
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

export function validRenewalDays(value:unknown):value is number[]{return Array.isArray(value)&&value.length>=1&&value.length<=5&&value.every(n=>Number.isInteger(n)&&n>=1&&n<=180)&&new Set(value).size===value.length;}

export function validNoticeSchedule(value:unknown):value is NoticeSchedule{const d=record(value),valid=(v:unknown,min:number)=>Array.isArray(v)&&v.length>=1&&v.length<=5&&v.every(n=>Number.isInteger(n)&&n>=min&&n<=180)&&new Set(v).size===v.length;return valid(d.renewal,1)&&valid(d.payment,0)&&Number.isInteger(d.claimEveryDays)&&Number(d.claimEveryDays)>=1&&Number(d.claimEveryDays)<=90;}
