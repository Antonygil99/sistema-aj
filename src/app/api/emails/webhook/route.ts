import { NextResponse } from 'next/server';
import { resendConfig } from '@/integrations/resend/server';
import { applyEmailEvent } from '@/modules/email/server';
import { verifyWebhook } from '@/modules/email/webhook';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Resend delivery events (sent, delivered, bounced, complained, failed) update the email history. Signed with Svix.
export async function POST(request: Request) {
  const secret = resendConfig()?.webhookSecret;
  if (!secret) return NextResponse.json({ error: 'EMAIL_WEBHOOK_NOT_CONFIGURED' }, { status: 503 });
  const body = await request.text();
  if (body.length > 256 * 1024) return NextResponse.json({ error: 'PAYLOAD_TOO_LARGE' }, { status: 413 });
  const headers = { id: request.headers.get('svix-id'), timestamp: request.headers.get('svix-timestamp'), signature: request.headers.get('svix-signature') };
  if (!verifyWebhook(secret, headers, body)) return NextResponse.json({ error: 'INVALID_SIGNATURE' }, { status: 401 });
  try {
    const event = JSON.parse(body) as { type?: unknown; data?: { email_id?: unknown } };
    if (typeof event.type === 'string' && typeof event.data?.email_id === 'string') await applyEmailEvent(event.type, event.data.email_id);
    return NextResponse.json({ ok: true });
  } catch {
    // Resend retries non-2xx responses; a malformed body would never succeed, so it is acknowledged.
    return NextResponse.json({ ok: false });
  }
}
