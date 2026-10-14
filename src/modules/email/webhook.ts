// Resend signs webhooks with Svix: HMAC-SHA256 over "<svix-id>.<svix-timestamp>.<raw body>" with the base64 key
// after "whsec_". Free of server-only so tests/email.test.ts can verify it.
import { createHmac, timingSafeEqual } from 'node:crypto';
const TOLERANCE = 5 * 60 * 1000;
export function verifyWebhook(secret: string, headers: { id: string | null; timestamp: string | null; signature: string | null }, body: string, now = Date.now()) {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature || !/^\d+$/.test(timestamp)) return false;
  if (Math.abs(now - Number(timestamp) * 1000) > TOLERANCE) return false;
  const key = Buffer.from(secret.startsWith('whsec_') ? secret.slice(6) : secret, 'base64');
  if (!key.length) return false;
  const expected = createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest();
  return signature.split(' ').some(part => {
    const [version, value] = part.split(',');
    if (version !== 'v1' || !value) return false;
    const actual = Buffer.from(value, 'base64');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  });
}
