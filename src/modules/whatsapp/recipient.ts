// Some inbound Mexican WhatsApp ids retain the legacy mobile 1. The test allowlist
// can contain the same person's E.164 +52 number instead. Only use this equivalent
// after Meta explicitly rejects the original as not allowed (131030), never after
// an accepted or ambiguous request. Keep the original contact identity/history.
export function mexicoAllowlistAlternative(contactId: string): string | null {
  const legacy = /^521([2-9]\d{9})$/.exec(contactId);
  return legacy ? `52${legacy[1]}` : null;
}
// Presentation only. This does not rewrite the provider id or merge conversations.
export const displayWhatsAppContact = (contactId: string) => `+${mexicoAllowlistAlternative(contactId) ?? contactId}`;
export function whatsAppPhoneSearch(query: string): string[] {
  if (!/^[+\d\s()-]+$/.test(query)) return [];
  const digits = query.replace(/\D/g, '');
  if (!digits) return [];
  const canonical = /^52([2-9]\d{9})$/.exec(digits);
  const equivalent = canonical ? `521${canonical[1]}` : mexicoAllowlistAlternative(digits);
  return [...new Set([digits, ...(equivalent ? [equivalent] : [])])];
}
