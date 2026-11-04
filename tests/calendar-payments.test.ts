import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paymentEvent, paymentEventId } from '../src/modules/calendar/payment-event';
import { renewalEventId, renewalFingerprint } from '../src/modules/calendar/renewal-event';
import { calendarGoogle } from '../src/modules/calendar/google';
const payment = { id: 'receipt', amount: '1100.25', currency: 'MXN', status: 'OVERDUE', dueDate: new Date('2026-12-31'), policy: { id: 'policy', number: '123', clientId: 'client', client: { name: 'Cliente' } } };
test('payment calendar keeps exact amount/currency and original day, with receipt deep link and separate event IDs', () => {
  const body = paymentEvent(payment, 'https://crm.example.com');
  assert.deepEqual(body.start, { date: '2026-12-31' }); assert.deepEqual(body.end, { date: '2027-01-01' });
  assert.match(body.description, /1100\.25 MXN/); assert.match(body.description, /Estado en el CRM: Vencido/);
  assert.match(body.description, /\/crm\/clientes\/client\?recibo=receipt#pagos-policy/);
  assert.match(paymentEvent({ ...payment, currency: 'UDI' }, 'https://crm.example.com').description, /1100\.25 UDI/);
  assert.notEqual(paymentEventId('ale', 'receipt', 0), paymentEventId('joel', 'receipt', 0));
  assert.notEqual(paymentEventId('ale', 'receipt', 0), renewalEventId('ale', 'receipt', 0));
  assert.notEqual(renewalFingerprint(body), renewalFingerprint(paymentEvent({ ...payment, amount: '1100.26' }, 'https://crm.example.com')));
});
test('payment sync only updates its own marked events and never cancels a renewal', async () => {
  let deletes = 0, inserts = 0;
  const api = calendarGoogle('fixture', async (_url, options) => {
    if (options?.method === 'POST') {
      const body = JSON.parse(String(options.body));
      assert.deepEqual(body.extendedProperties.private, { sistemaAjPayment: 'payment-id' });
      assert.equal(body.attendees, undefined); inserts++;
      return Response.json({ id: 'payment-id' });
    }
    if (options?.method === 'DELETE') deletes++;
    return inserts ? Response.json({ id: 'payment-id', extendedProperties: { private: { sistemaAjRenewal: 'payment-id' } } }) : Response.json({}, { status: 404 });
  });
  await api.syncPayment('payment-id', paymentEvent(payment, 'https://crm.example.com'));
  await assert.rejects(api.cancelPayment('payment-id'), { code: 'CALENDAR_EVENT_CHANGED' });
  await assert.rejects(api.syncPayment('payment-id', paymentEvent(payment, 'https://crm.example.com')), { code: 'CALENDAR_EVENT_CHANGED' });
  assert.equal(inserts, 1); assert.equal(deletes, 0);
});
