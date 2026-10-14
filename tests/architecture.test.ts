import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifySignature } from '../src/integrations/whatsapp/signature';
import { createSchema as policy } from '../src/modules/polizas/schema';
import { createSchema as quote } from '../src/modules/cotizaciones/schema';
import { createSchema as payment } from '../src/modules/pagos/schema';
test('WhatsApp acepta firma auténtica y rechaza alteraciones o firma malformada', () => {
  const body = '{"message":"hola"}'; const secret = 'test-only';
  const signature = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
  assert.equal(verifySignature(body, signature, secret), true);
  assert.equal(verifySignature(body + ' ', signature, secret), false);
  assert.equal(verifySignature(body, 'sha256=xx', secret), false);
  assert.equal(verifySignature(body, null, secret), false);
});
test('rechaza pólizas con fechas invertidas e importes negativos', () => {
  const input = { number: 'TEST', clientId: 'client', insurer: 'Demo', product: 'Auto', premium: '100.00', startDate: '2026-01-01T00:00:00Z', endDate: '2027-01-01T00:00:00Z' };
  assert.equal(policy.safeParse(input).success, true);
  assert.equal(policy.safeParse({ ...input, premium: '-1.00' }).success, false);
  assert.equal(policy.safeParse({ ...input, endDate: input.startDate }).success, false);
});
test('cotización requiere un solo destinatario y pago liquidado requiere fecha', () => {
  const input = { reference: 'Q1', product: 'Auto', amount: '100.00' };
  assert.equal(quote.safeParse(input).success, false);
  assert.equal(quote.safeParse({ ...input, clientId: 'c' }).success, true);
  assert.equal(quote.safeParse({ ...input, clientId: 'c', prospectId: 'p' }).success, false);
  assert.equal(payment.safeParse({ policyId: 'p', amount: '100.00', dueDate: '2026-01-01T00:00:00Z', status: 'PAID' }).success, false);
});
