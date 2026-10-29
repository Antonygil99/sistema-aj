import { authenticate, apiError } from '@/lib/api';
import { getDb } from '@/lib/db';
import { ownChannels, channelCredentials } from '@/modules/whatsapp/channels';
import { z } from 'zod';
import { whatsAppPhoneSearch } from '@/modules/whatsapp/recipient';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  const auth = await authenticate(request); if (auth.denied) return auth.denied;
  try {
    const { q, skip } = z.object({ q: z.string().trim().max(100).default(''), skip: z.coerce.number().int().min(0).max(100000).default(0) }).parse(Object.fromEntries(new URL(request.url).searchParams));
    const channels=await ownChannels(auth.actor),scope={phoneNumberId:{in:channels.flatMap(c=>c.phoneNumberId?[c.phoneNumberId]:[])}};
    const db = getDb(), where = {...scope,...(q ? { OR: [{ displayName: { contains: q, mode: 'insensitive' as const } }, { contactId: { contains: q } }, ...whatsAppPhoneSearch(q).map(phone => ({ contactId: { contains: phone } }))] } : {})};
    const [rows, total, open] = await Promise.all([
      db.whatsAppConversation.findMany({ where, skip, take: 30, orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }], include: { messages: { orderBy: [{ sentAt: 'desc' }, { id: 'desc' }], take: 1 } } }),
      db.whatsAppConversation.count({ where }), db.whatsAppConversation.count({ where: { ...scope,closed: false } }),
    ]);
    return Response.json({ rows, total, open, sendingConfigured: channels.some(c=>!!channelCredentials(c)),channels:channels.map(c=>({id:c.id,name:c.name,configured:Boolean(channelCredentials(c)),linked:Boolean(c.phoneNumberId)})) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return apiError(error); }
}
