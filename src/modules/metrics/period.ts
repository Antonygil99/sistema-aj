// Pure helpers for dashboard metrics: calendar month in Mexico City, deltas and ratios. Unit tested.
// Mexico City has no daylight saving time since 2022: it is UTC-6 all year.
const OFFSET_HOURS = 6;
const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
function localParts(now: Date) {
  const local = new Date(now.getTime() - OFFSET_HOURS * 3600000);
  return { year: local.getUTCFullYear(), month: local.getUTCMonth(), day: local.getUTCDate() };
}
const startOf = (year: number, month: number) => new Date(Date.UTC(year, month, 1, OFFSET_HOURS));
// The current local month [start, end) and the previous one, as UTC instants.
export function monthRange(now = new Date()) {
  const { year, month, day } = localParts(now);
  const today = new Date(Date.UTC(year, month, day));
  return {
    start: startOf(year, month), end: startOf(year, month + 1), prevStart: startOf(year, month - 1),
    label: `${monthNames[month]} ${year}`, previousLabel: monthNames[(month + 11) % 12],
    // CRM due dates are stored at UTC midnight of their calendar day.
    today, in30: new Date(today.getTime() + 30 * 86400000),
  };
}
export type Delta = { direction: 'up' | 'down' | 'same'; text: string };
export function delta(current: number, previous: number, previousLabel: string): Delta {
  const diff = current - previous;
  if (diff === 0) return { direction: 'same', text: `Igual que en ${previousLabel}` };
  return { direction: diff > 0 ? 'up' : 'down', text: `${diff > 0 ? '+' : '−'}${Math.abs(diff)} vs ${previousLabel}` };
}
export function ratio(part: number, whole: number) { return whole > 0 ? Math.round(part / whole * 100) : null; }
export function compactMoney(amount: number, currency = 'MXN') {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency, notation: amount >= 100000 ? 'compact' : 'standard', maximumFractionDigits: amount >= 100000 ? 1 : 0 }).format(amount);
}
