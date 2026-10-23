import 'server-only';
import { getDb } from '@/lib/db';
import { parseWhatsApp, deliveryState } from './parse';

// Project one durable event atomically. Unique Meta ids make retries harmless.
export async function processWhatsAppEvent(id: string) {
  const db = getDb();
  return db.$transaction(async tx => {
    const events = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "WebhookEvent" WHERE id = ${id} AND "processedAt" IS NULL FOR UPDATE`;
    if (!events.length) return;
    const event = await tx.webhookEvent.findUniqueOrThrow({ where: { id } });
    const { messages, statuses } = parseWhatsApp(event.payload);
    for (const message of messages) {
      const { phoneNumberId, contactId, displayName, sentAt, ...content } = message;
      const conversation = await tx.whatsAppConversation.upsert({
        where: { phoneNumberId_contactId: { phoneNumberId, contactId } },
        create: { phoneNumberId, contactId, displayName, lastMessageAt: sentAt, lastInboundAt: sentAt }, update: {},
      });
      const result = await tx.whatsAppMessage.createMany({ data: [{ ...content, sentAt, conversationId: conversation.id, direction: 'IN', status: 'RECEIVED' }], skipDuplicates: true });
      if (!result.count) continue;
      await tx.whatsAppConversation.updateMany({ where: { id: conversation.id, lastMessageAt: { lte: sentAt } }, data: { lastMessageAt: sentAt, displayName } });
      await tx.whatsAppConversation.updateMany({ where: { id: conversation.id, OR: [{ lastInboundAt: null }, { lastInboundAt: { lte: sentAt } }] }, data: { lastInboundAt: sentAt, closed: false } });
    }
    for (const status of statuses) {
      await tx.whatsAppReceipt.upsert({ where: { metaId: status.metaId },
        create: { metaId: status.metaId, phoneNumberId: status.phoneNumberId, status: status.status }, update: {} });
      await tx.$queryRaw`SELECT "metaId" FROM "WhatsAppReceipt" WHERE "metaId" = ${status.metaId} FOR UPDATE`;
      const receipt = await tx.whatsAppReceipt.findUniqueOrThrow({ where: { metaId: status.metaId } });
      if (receipt.phoneNumberId !== status.phoneNumberId) continue;
      await tx.whatsAppReceipt.update({ where: { metaId: status.metaId }, data: {
        status: deliveryState(receipt.status, status.status),
        ...(status.status === 'delivered' && !receipt.deliveredAt ? { deliveredAt: status.at } : {}),
        ...(status.status === 'read' && !receipt.readAt ? { readAt: status.at } : {}),
        ...(status.status === 'failed' ? { failureCode: status.failureCode } : {}),
      } });
      const message = await tx.whatsAppMessage.findUnique({ where: { metaId: status.metaId }, include: { conversation: true } });
      if (!message || message.direction !== 'OUT' || message.conversation.phoneNumberId !== status.phoneNumberId) continue;
      await tx.whatsAppMessage.update({ where: { id: message.id }, data: {
        status: deliveryState(message.status, status.status),
        ...(status.status === 'delivered' && !message.deliveredAt ? { deliveredAt: status.at } : {}),
        ...(status.status === 'read' && !message.readAt ? { readAt: status.at } : {}),
        ...(status.status === 'failed' ? { failureCode: status.failureCode } : {}),
      } });
    }
    await tx.webhookEvent.update({ where: { id }, data: { processedAt: new Date() } });
  }, { timeout: 15000 });
}
export async function syncWhatsAppEvents() {
  const pending = await getDb().webhookEvent.findMany({ where: { provider: 'whatsapp', processedAt: null }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 100, select: { id: true } });
  for (const event of pending) await processWhatsAppEvent(event.id);
  return { processed: pending.length, more: pending.length === 100 };
}
