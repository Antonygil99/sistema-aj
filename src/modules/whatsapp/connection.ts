import 'server-only';
import { whatsappSending } from './send';
import { metaFailure, failureKey } from './errors';
export async function checkWhatsAppConnection() {
  if (!whatsappSending()) return { ok: false, code: 'WA_SEND_NOT_CONFIGURED', metaCode: null };
  try {
    // Read only: never sends, registers or changes a number. Reading alone does not prove send permission.
    const response = await fetch(`https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}?fields=id`, {
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN!.trim()}` }, cache: 'no-store', signal: AbortSignal.timeout(10000),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) { const failure = metaFailure(data, response.status); return { ok: false, code: failureKey(failure.code), metaCode: failure.code, httpStatus: response.status }; }
    const ok = data?.id === process.env.WHATSAPP_PHONE_NUMBER_ID;
    return { ok, code: ok ? 'WA_NUMBER_READABLE' : 'WA_ACCOUNT_ACCESS', metaCode: null };
  } catch { return { ok: false, code: 'WA_CONNECTION_UNAVAILABLE', metaCode: null }; }
}
