import 'server-only';
import { getDb } from '@/lib/db';
import type { Actor } from '@/lib/api';
import { recordEvent } from '@/modules/events';
import { canReply } from './parse';
import { metaFailure, failureKey, storedFailure, messageFailure } from './errors';
import { mexicoAllowlistAlternative } from './recipient';
export class WhatsAppError extends Error { constructor(public code: string, public status: number) { super(code); } }
export function whatsappSending() {
  return Boolean(process.env.WHATSAPP_ACCESS_TOKEN?.trim() && /^\d+$/.test(process.env.WHATSAPP_PHONE_NUMBER_ID ?? '') && /^v\d+\.0$/.test(process.env.WHATSAPP_API_VERSION ?? ''));
}
export async function replyWhatsApp(conversationId: string, body: string, requestId: string, actor: Actor) {
  const db = getDb();
  const conversation = await db.whatsAppConversation.findUnique({ where: { id: conversationId } });
  if (!conversation) throw new WhatsAppError('WA_NOT_FOUND', 404);
  if (!whatsappSending() || conversation.phoneNumberId !== process.env.WHATSAPP_PHONE_NUMBER_ID) throw new WhatsAppError('WA_SEND_NOT_CONFIGURED', 503);
  const previous = await db.whatsAppMessage.findUnique({ where: { requestId } });
  if (previous) {
    if (previous.conversationId !== conversationId || previous.body !== body || previous.senderId !== actor.id) throw new WhatsAppError('WA_REQUEST_CONFLICT', 409);
    if (previous.status === 'UNKNOWN') throw new WhatsAppError('WA_DELIVERY_UNCERTAIN', 409);
    if (previous.status === 'SENDING') throw new WhatsAppError('WA_IN_PROGRESS', 409);
    if (previous.status === 'failed') throw new WhatsAppError(messageFailure(previous.failureCode), 502);
    return previous; // Never resend after a timeout, refresh or double click.
  }
  if (!canReply(conversation.lastInboundAt)) throw new WhatsAppError('WA_WINDOW_CLOSED', 409);
  const message = await db.$transaction(async tx => {
    // Serialize sends per conversation. A pending/ambiguous delivery must be resolved first.
    await tx.$queryRaw`SELECT id FROM "WhatsAppConversation" WHERE id = ${conversationId} FOR UPDATE`;
    const existing = await tx.whatsAppMessage.findUnique({ where: { requestId } });
    if (existing) throw new WhatsAppError('WA_IN_PROGRESS', 409);
    const pending = await tx.whatsAppMessage.count({ where: { conversationId, direction: 'OUT', status: { in: ['SENDING', 'UNKNOWN'] } } });
    if (pending) throw new WhatsAppError('WA_DELIVERY_UNCERTAIN', 409);
    return tx.whatsAppMessage.create({ data: { conversationId, requestId, body, direction: 'OUT', kind: 'text', status: 'SENDING', sentAt: new Date(), senderId: actor.id, senderName: actor.name } });
  });
  const phoneNumberId = conversation.phoneNumberId;
  async function sendRequest(to: string) {
    try {
      return await fetch(`https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION}/${phoneNumberId}/messages`, {
      method: 'POST', headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN!.trim()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'text', text: { preview_url: false, body } }),
      signal: AbortSignal.timeout(15000),
      });
    } catch {
      await db.whatsAppMessage.update({ where: { id: message.id }, data: { status: 'UNKNOWN' } });
      throw new WhatsAppError('WA_DELIVERY_UNCERTAIN', 409);
    }
  }
  let response = await sendRequest(conversation.contactId);
  let failure = response.ok ? null : metaFailure(await response.json().catch(() => null), response.status);
  const alternative = failure?.code === 131030 && response.status < 500 ? mexicoAllowlistAlternative(conversation.contactId) : null;
  if (alternative) {
    // The first attempt was explicitly rejected; no accepted send is repeated.
    response = await sendRequest(alternative);
    failure = response.ok ? null : metaFailure(await response.json().catch(() => null), response.status);
  }
  if (!response.ok) {
    // An upstream server failure can be ambiguous; do not retry it automatically.
    const status = response.status >= 500 ? 'UNKNOWN' : 'failed';
    await db.whatsAppMessage.update({ where: { id: message.id }, data: { status, failureCode: storedFailure(failure?.code ?? null, response.status) } });
    throw new WhatsAppError(status === 'UNKNOWN' ? 'WA_DELIVERY_UNCERTAIN' : failureKey(failure?.code ?? null), 502);
  }
  let metaId: string | undefined;
  try { const data = await response.json(); metaId = data.messages?.[0]?.id; } catch { /* Preserve ambiguous state. */ }
  if (typeof metaId !== 'string' || !metaId || metaId.length > 255) {
    await db.whatsAppMessage.update({ where: { id: message.id }, data: { status: 'UNKNOWN' } });
    throw new WhatsAppError('WA_DELIVERY_UNCERTAIN', 409);
  }
  const saved = await db.$transaction(async tx => {
    // A status callback can race this response. Reading the durable receipt preserves that information.
    const receipt = await tx.whatsAppReceipt.findUnique({ where: { metaId } });
    return tx.whatsAppMessage.update({ where: { id: message.id }, data: { metaId, status: receipt?.status ?? 'ACCEPTED',
      deliveredAt: receipt?.deliveredAt, readAt: receipt?.readAt, failureCode: receipt?.failureCode } });
  });
  await db.whatsAppConversation.updateMany({ where: { id: conversationId, lastMessageAt: { lt: message.sentAt } }, data: { lastMessageAt: message.sentAt } });
  await recordEvent(actor, 'created', 'whatsapp', saved.id, 'Respuesta de WhatsApp', { conversationId, mexicoAllowlistAlternativeUsed: Boolean(alternative) });
  return saved;
}
