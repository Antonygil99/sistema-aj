import { createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { apiError } from '@/lib/api';
import { verifySignature } from '@/integrations/whatsapp/signature';
import { processWhatsAppEvent } from '@/modules/whatsapp/server';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!token) return Response.json({ error: 'WHATSAPP_NOT_CONFIGURED' }, { status: 503 });
  const received = Buffer.from(url.searchParams.get('hub.verify_token') ?? '');
  const expected = Buffer.from(token);
  const challenge = url.searchParams.get('hub.challenge');
  if (url.searchParams.get('hub.mode') === 'subscribe' && challenge && received.length === expected.length && timingSafeEqual(received, expected)) return new Response(challenge);
  return Response.json({ error: 'FORBIDDEN' }, { status: 403 });
}
export async function POST(request: Request) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return Response.json({ error: 'WHATSAPP_NOT_CONFIGURED' }, { status: 503 });
  const raw = await request.text();
  if (Buffer.byteLength(raw) > 1048576) return Response.json({ error: 'PAYLOAD_TOO_LARGE' }, { status: 413 });
  if (!verifySignature(raw, request.headers.get('x-hub-signature-256'), secret)) return Response.json({ error: 'INVALID_SIGNATURE' }, { status: 401 });
  try {
    const payload = z.object({ object: z.literal('whatsapp_business_account'), entry: z.array(z.record(z.string(), z.json())).min(1) }).catchall(z.json()).parse(JSON.parse(raw));
    const payloadHash = createHash('sha256').update(raw).digest('hex');
    const event = await getDb().webhookEvent.upsert({ where: { payloadHash }, create: { payloadHash, payload }, update: {} });
    await processWhatsAppEvent(event.id);
    return Response.json({ received: true });
  } catch (error) { return apiError(error); }
}
