import {getAreaDb} from '@/modules/areas/db';
import { authenticate, apiError } from '@/lib/api';

import { z } from 'zod';
import { deliveryState, type DeliveryStatus } from '@/modules/whatsapp/parse';
import { recordEvent } from '@/modules/events';
import { ownConversation, conversationScope, ownChannel, channelCredentials } from '@/modules/whatsapp/channels';
import { assistMessage } from '@/modules/whatsapp/assistance';
export const runtime = 'nodejs';
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  const auth = await authenticate(request); if (auth.denied) return auth.denied;
  try {
    const { id } = await context.params;
    const { before } = z.object({ before: z.string().datetime().optional() }).parse(Object.fromEntries(new URL(request.url).searchParams));
    const conversation = await ownConversation(id,auth.actor);
    if (!conversation) return Response.json({ error: 'WA_NOT_FOUND' }, { status: 404 });
    // Cursor is a message id, not just a date: equal timestamps cannot skip messages.
    const cursorId = new URL(request.url).searchParams.get('cursor');
    if (cursorId && cursorId.length > 100) return Response.json({ error: 'INVALID_INPUT' }, { status: 400 });
    const cursor = cursorId ? await getAreaDb(auth.actor).whatsAppMessage.findFirst({ where: { id: cursorId, conversationId: id } }) : null;
    if (cursorId && !cursor) return Response.json({ error: 'INVALID_INPUT' }, { status: 400 });
    const rows = await getAreaDb(auth.actor).whatsAppMessage.findMany({ where: { conversationId: id,
      ...(cursor ? { OR: [{ sentAt: { lt: cursor.sentAt } }, { sentAt: cursor.sentAt, id: { lt: cursor.id } }] } : before ? { sentAt: { lt: new Date(before) } } : {}) },
      orderBy: [{ sentAt: 'desc' }, { id: 'desc' }], take: 51 });
    const metaIds = rows.flatMap(row => row.direction === 'OUT' && row.metaId ? [row.metaId] : []);
    const receipts = await getAreaDb(auth.actor).whatsAppReceipt.findMany({ where: { metaId: { in: metaIds }, phoneNumberId: conversation.phoneNumberId } });
    const byId = new Map(receipts.map(receipt => [receipt.metaId, receipt]));
    const visible = rows.slice(0, 50).reverse().map(row => {
      const receipt = row.metaId ? byId.get(row.metaId) : undefined;
      return receipt ? { ...row, status: deliveryState(row.status, receipt.status as DeliveryStatus['status']), deliveredAt: receipt.deliveredAt ?? row.deliveredAt, readAt: receipt.readAt ?? row.readAt } : row;
    });
    // Always classify the newest inbound, never an outgoing reply or the current history page.
    // This query runs only after the channel ownership check above. No raw webhook data is returned.
    const latest = await getAreaDb(auth.actor).whatsAppMessage.findFirst({ where: { conversationId: id, direction: 'IN' }, orderBy: [{ sentAt: 'desc' }, { id: 'desc' }], select: { id: true, kind: true, body: true } });
    return Response.json({ conversation, rows: visible, hasMore: rows.length > 50, assistance: latest ? assistMessage(latest) : null,
      canSend: Boolean(channelCredentials(await ownChannel(auth.actor,conversation.phoneNumberId))) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return apiError(error); }
}
export async function PATCH(request: Request, context: Context) {
  const auth = await authenticate(request, 'ADMIN'); if (auth.denied) return auth.denied;
  try {
    const { closed } = z.object({ closed: z.boolean() }).strict().parse(await request.json());
    const { id } = await context.params;
    const result = await getAreaDb(auth.actor).whatsAppConversation.updateMany({ where: { id,...await conversationScope(auth.actor) }, data: { closed } });
    if (result.count) await recordEvent(auth.actor, 'updated', 'whatsapp', id, closed ? 'Conversación resuelta' : 'Conversación reabierta');
    return result.count ? Response.json({ saved: true }) : Response.json({ error: 'WA_NOT_FOUND' }, { status: 404 });
  } catch (error) { return apiError(error); }
}
