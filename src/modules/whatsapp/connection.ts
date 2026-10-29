import 'server-only';
import { whatsappSending } from './send';
import { metaFailure, failureKey } from './errors';
import { ownChannel, channelCredentials } from './channels';
import type { Actor } from '@/lib/api';
export async function checkWhatsAppConnection(actor?:Actor) {
  // No-actor path exists only for the isolated provider diagnostic tests; HTTP routes always pass an actor.
  const credentials=actor?channelCredentials(await ownChannel(actor)):whatsappSending()?{version:process.env.WHATSAPP_API_VERSION!,phoneNumberId:process.env.WHATSAPP_PHONE_NUMBER_ID!,token:process.env.WHATSAPP_ACCESS_TOKEN!.trim()}:null;
  if (!credentials) return { ok: false, code: 'WA_SEND_NOT_CONFIGURED', metaCode: null };
  try {
    // Read only: never sends, registers or changes a number. Reading alone does not prove send permission.
    const response = await fetch(`https://graph.facebook.com/${credentials.version}/${credentials.phoneNumberId}?fields=id`, {
      headers: { Authorization: `Bearer ${credentials.token}` }, cache: 'no-store', signal: AbortSignal.timeout(10000),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) { const failure = metaFailure(data, response.status); return { ok: false, code: failureKey(failure.code), metaCode: failure.code, httpStatus: response.status }; }
    const ok = data?.id === credentials.phoneNumberId;
    return { ok, code: ok ? 'WA_NUMBER_READABLE' : 'WA_ACCOUNT_ACCESS', metaCode: null };
  } catch { return { ok: false, code: 'WA_CONNECTION_UNAVAILABLE', metaCode: null }; }
}
