import { createHmac, timingSafeEqual } from 'node:crypto';
export function verifySignature(raw: string, signature: string | null, secret: string) {
  if (!secret || !signature || !/^sha256=[a-f0-9]{64}$/.test(signature)) return false;
  const expected = Buffer.from(createHmac('sha256', secret).update(raw).digest('hex'), 'hex');
  const actual = Buffer.from(signature.slice(7), 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
