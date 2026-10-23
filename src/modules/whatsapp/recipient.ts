// Some inbound Mexican WhatsApp ids retain the legacy mobile 1. The test allowlist
// can contain the same person's E.164 +52 number instead. Only use this equivalent
// after Meta explicitly rejects the original as not allowed (131030), never after
// an accepted or ambiguous request. Keep the original contact identity/history.
export function mexicoAllowlistAlternative(contactId: string): string | null {
  const legacy = /^521([2-9]\d{9})$/.exec(contactId);
  return legacy ? `52${legacy[1]}` : null;
}
