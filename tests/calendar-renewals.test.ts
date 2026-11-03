import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renewalEvent, renewalEventId, renewalFingerprint } from '../src/modules/calendar/renewal-event';
import { calendarGoogle } from '../src/modules/calendar/google';
const policy = { id: 'policy', number: '123', clientId: 'client', endDate: new Date('2026-12-31T00:00:00Z'), client: { name: 'Cliente' } };
const body = renewalEvent(policy, 'https://crm.example.com');
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });

test('renewal is an all-day event, exclusive end rolls over year, ID isolates brokers and generations', () => {
  assert.deepEqual(body.start, { date: '2026-12-31' }); assert.deepEqual(body.end, { date: '2027-01-01' });
  assert.match(body.description, /https:\/\/crm.example.com\/crm\/clientes\/client/);
  assert.notEqual(renewalEventId('ale', 'policy', 0), renewalEventId('joel', 'policy', 0));
  assert.notEqual(renewalEventId('ale', 'policy', 0), renewalEventId('ale', 'policy', 1));
  assert.notEqual(renewalFingerprint(body), renewalFingerprint(renewalEvent({ ...policy, endDate: new Date('2027-01-01') }, 'https://crm.example.com')));
});
test('renewal retries do not duplicate events or notify clients; updates preserve Google reminders', async () => {
  let stored: Record<string, unknown> | null = null, inserts = 0, patches = 0;
  const api = calendarGoogle('private', async (url, options) => {
    const method = options?.method;
    if (method === 'POST' || method === 'PATCH') {
      assert.match(String(url), /sendUpdates=none/);
      const sent = JSON.parse(String(options?.body)); assert.equal(sent.attendees, undefined);
      if (method === 'POST') { inserts++; assert.deepEqual(sent.reminders, { useDefault: true }); stored = sent; }
      else { patches++; assert.equal(sent.reminders, undefined); stored = { ...stored, ...sent }; }
      return json(stored);
    }
    return stored ? json(stored) : json({}, 404);
  });
  await api.syncRenewal('abc123', body); await api.syncRenewal('abc123', { ...body, summary: 'Nueva fecha' });
  assert.equal(inserts, 1); assert.equal(patches, 1);
});
test('renewal conflict after a timed out insert reconciles only the matching managed event', async () => {
  let reads = 0;
  const api = calendarGoogle('private', async (_url, options) => {
    if (options?.method === 'POST') return json({}, 409);
    if (options?.method === 'PATCH') return json({ id: 'abc' });
    reads++; return reads === 1 ? json({}, 404) : json({ id: 'abc', extendedProperties: { private: { sistemaAjRenewal: 'abc' } } });
  });
  assert.equal((await api.syncRenewal('abc', body)).id, 'abc');
});
test('renewal never patches or deletes unrelated Google events', async () => {
  let writes = 0;
  const api = calendarGoogle('private', async (_url, options) => {
    if (options?.method !== 'GET') writes++;
    return json({ id: 'abc', summary: 'Personal' });
  });
  await assert.rejects(api.syncRenewal('abc', body), { code: 'CALENDAR_EVENT_CHANGED' });
  await assert.rejects(api.cancelRenewal('abc'), { code: 'CALENDAR_EVENT_CHANGED' });
  assert.equal(writes, 0);
});
test('cancelled IDs request a new generation; repeated deletion is safe', async () => {
  const api = calendarGoogle('private', async () => json({ id: 'abc', status: 'cancelled' }));
  await assert.rejects(api.syncRenewal('abc', body), { code: 'CALENDAR_EVENT_NOT_FOUND' });
  await api.cancelRenewal('abc');
});
