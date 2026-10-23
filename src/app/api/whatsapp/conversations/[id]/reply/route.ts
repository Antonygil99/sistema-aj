import { authenticate, apiError } from '@/lib/api';
import { replyWhatsApp } from '@/modules/whatsapp/send';
import { z } from 'zod';
export const runtime = 'nodejs';
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authenticate(request, 'ADMIN'); if (auth.denied) return auth.denied;
  try {
    const { body, requestId } = z.object({ body: z.string().trim().min(1).max(4096), requestId: z.string().uuid() }).strict().parse(await request.json());
    return Response.json(await replyWhatsApp((await context.params).id, body, requestId, auth.actor), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return apiError(error); }
}
