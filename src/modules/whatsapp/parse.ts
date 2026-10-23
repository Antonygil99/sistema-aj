// Untrusted webhook values stay plain data. No media downloads or agent execution here.
type RecordValue = Record<string, unknown>;
const object = (value: unknown): RecordValue => value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {};
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const text = (value: unknown, max = 4096) => typeof value === 'string' ? value.slice(0, max) : '';
const digits = (value: unknown) => /^[1-9]\d{6,19}$/.test(text(value, 30)) ? String(value) : '';
function date(value: unknown): Date | null {
  if (!/^\d{9,12}$/.test(String(value))) return null;
  const result = new Date(Number(value) * 1000);
  return Number.isFinite(result.getTime()) ? result : null;
}
export type IncomingMessage = { phoneNumberId: string; contactId: string; displayName: string; metaId: string; kind: string; body: string; sentAt: Date };
export type DeliveryStatus = { phoneNumberId: string; metaId: string; status: 'sent' | 'delivered' | 'read' | 'failed'; at: Date; failureCode: string | null };
export function parseWhatsApp(payload: unknown) {
  const messages: IncomingMessage[] = [], statuses: DeliveryStatus[] = [];
  for (const entry of array(object(payload).entry)) for (const change of array(object(entry).changes)) {
    if (object(change).field !== 'messages') continue; // Ignore history, echoes and unrelated account events.
    const value = object(object(change).value), phoneNumberId = digits(object(value.metadata).phone_number_id);
    if (!phoneNumberId) continue;
    for (const raw of array(value.messages)) {
      const item = object(raw), contactId = digits(item.from), sentAt = date(item.timestamp), metaId = text(item.id, 255);
      if (!contactId || !sentAt || !metaId) continue;
      // Meta's dashboard sample is not a real conversation.
      if (contactId === '16315551181' && sentAt.getUTCFullYear() < 2020) continue;
      const contact = array(value.contacts).map(object).find(c => c.wa_id === contactId);
      const kind = text(item.type, 30) || 'unknown';
      const content = kind === 'text' ? text(object(item.text).body) : text(object(item[kind]).caption);
      messages.push({ phoneNumberId, contactId, metaId, sentAt, kind, body: content,
        displayName: text(object(contact?.profile).name, 120) || contactId });
    }
    for (const raw of array(value.statuses)) {
      const item = object(raw), at = date(item.timestamp), metaId = text(item.id, 255);
      if (!at || !metaId || !['sent', 'delivered', 'read', 'failed'].includes(String(item.status))) continue;
      const error = object(array(item.errors)[0]);
      statuses.push({ phoneNumberId, metaId, at, status: item.status as DeliveryStatus['status'], failureCode: error.code == null ? null : String(error.code).slice(0, 40) });
    }
  }
  return { messages, statuses };
}
export const canReply = (lastInbound: Date | string | null, now = new Date()) => {
  if (!lastInbound) return false;
  const age = now.getTime() - new Date(lastInbound).getTime();
  return age >= 0 && age < 24 * 60 * 60 * 1000;
};
export function deliveryState(current: string, incoming: DeliveryStatus['status']) {
  const rank: Record<string, number> = { SENDING: 0, UNKNOWN: 0, ACCEPTED: 1, sent: 2, failed: 2, delivered: 3, read: 4 };
  return (rank[incoming] ?? 0) > (rank[current] ?? 0) ? incoming : current;
}
