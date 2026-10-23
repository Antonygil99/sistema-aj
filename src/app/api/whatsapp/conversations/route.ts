import { authenticate, apiError } from '@/lib/api';
import { getDb } from '@/lib/db';
import { whatsappSending } from '@/modules/whatsapp/send';
import { z } from 'zod';
import { whatsAppPhoneSearch } from '@/modules/whatsapp/recipient';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  const auth = await authenticate(request); if (auth.denied) return auth.denied;
  try {
    const { q, skip } = z.object({ q: z.string().trim().max(100).default(''), skip: z.coerce.number().int().min(0).max(100000).default(0) }).parse(Object.fromEntries(new URL(request.url).searchParams));
    const db = getDb(), where = q ? { OR: [{ displayName: { contains: q, mode: 'insensitive' as const } }, { contactId: { contains: q } }, ...whatsAppPhoneSearch(q).map(phone => ({ contactId: { contains: phone } }))] } : {};
    const [rows, total, open] = await Promise.all([
      db.whatsAppConversation.findMany({ where, skip, take: 30, orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }], include: { messages: { orderBy: [{ sentAt: 'desc' }, { id: 'desc' }], take: 1 } } }),
      db.whatsAppConversation.count({ where }), db.whatsAppConversation.count({ where: { closed: false } }),
    ]);
    return Response.json({ rows, total, open, sendingConfigured: whatsappSending() }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return apiError(error); }
}
