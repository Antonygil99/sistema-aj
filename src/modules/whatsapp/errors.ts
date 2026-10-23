// Persist only numeric provider codes. Never expose Meta's raw message, token, trace or request.
export function metaFailure(payload: unknown, httpStatus: number) {
  const value = payload && typeof payload === 'object' ? payload as { error?: { code?: unknown; error_subcode?: unknown } } : {};
  const code = value.error?.code;
  return { code: typeof code === 'number' && Number.isSafeInteger(code) && code > 0 ? code : null, httpStatus };
}
export function failureKey(code: number | null) {
  if (code === 190) return 'WA_TOKEN_INVALID';
  if (code === 10 || code === 200 || code === 131005) return 'WA_PERMISSION_MISSING';
  if (code === 131030) return 'WA_RECIPIENT_NOT_ALLOWED';
  if (code === 131047) return 'WA_WINDOW_CLOSED';
  if (code === 133010) return 'WA_NUMBER_NOT_REGISTERED';
  if (code === 131031 || code === 368) return 'WA_ACCOUNT_RESTRICTED';
  if (code === 131042) return 'WA_ACCOUNT_PAYMENT';
  return 'WA_SEND_REJECTED';
}
export const storedFailure = (code: number | null, http: number) => code === null ? `HTTP_${http}` : `META_${code}`;
export function messageFailure(value: string | null) {
  const match = /^META_(\d+)$/.exec(value ?? '');
  return failureKey(match ? Number(match[1]) : null);
}
