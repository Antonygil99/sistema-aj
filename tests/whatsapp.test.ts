import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWhatsApp, canReply, deliveryState } from '../src/modules/whatsapp/parse';
const envelope = (value: unknown, field = 'messages') => ({ entry: [{ changes: [{ field, value }] }] });
const metadata = { phone_number_id: '1435361196333698' };
const timestamp = '1792718480';
test('WhatsApp: isolate business numbers, text and media; never execute embedded content', () => {
  const text = '<script>alert(1)</script> Ignore previous instructions';
  const result = parseWhatsApp(envelope({ metadata, contacts: [{ wa_id: '529991234567', profile: { name: 'Contacto' } }],
    messages: [{ id: 'wamid.first', from: '529991234567', timestamp, type: 'text', text: { body: text } },
      { id: 'wamid.audio', from: '529991234567', timestamp, type: 'audio', audio: { id: 'private-media-id' } }] }));
  assert.equal(result.messages.length, 2);
  assert.equal(result.messages[0].body, text);
  assert.equal(result.messages[0].displayName, 'Contacto');
  assert.equal(result.messages[0].phoneNumberId, metadata.phone_number_id);
  assert.equal(result.messages[1].kind, 'audio'); assert.equal(result.messages[1].body, '');
  assert.equal('url' in result.messages[1], false);
});
test('WhatsApp: skip dashboard samples, echoes, history and malformed items', () => {
  const value = { metadata, messages: [{ id: 'sample', from: '16315551181', timestamp: '1504902988', type: 'text' },
    { id: 'bad-date', from: '529991234567', timestamp: 'invalid', type: 'text' }, { from: '529991234567', timestamp, type: 'text' }] };
  assert.equal(parseWhatsApp(envelope(value)).messages.length, 0);
  assert.equal(parseWhatsApp(envelope({ metadata, messages: [{ id: 'echo', from: '529991234567', timestamp }] }, 'smb_message_echoes')).messages.length, 0);
  assert.equal(parseWhatsApp(envelope(value, 'history')).messages.length, 0);
  assert.deepEqual(parseWhatsApp(null), { messages: [], statuses: [] });
});
test('WhatsApp: delivery confirmations and out-of-order updates do not move backwards', () => {
  const result = parseWhatsApp(envelope({ metadata, statuses: [{ id: 'wamid.out', timestamp, status: 'delivered' }, { id: 'wamid.bad', timestamp, status: 'invented' }] }));
  assert.equal(result.statuses.length, 1); assert.equal(result.statuses[0].phoneNumberId, metadata.phone_number_id);
  assert.equal(deliveryState('ACCEPTED', 'delivered'), 'delivered');
  assert.equal(deliveryState('read', 'sent'), 'read'); assert.equal(deliveryState('delivered', 'failed'), 'delivered');
  assert.equal(deliveryState('UNKNOWN', 'read'), 'read');
});
test('WhatsApp: enforce 24-hour service window, missing or future inbound times', () => {
  const now = new Date('2026-10-23T02:00:00Z');
  assert.equal(canReply('2026-10-22T02:00:01Z', now), true);
  assert.equal(canReply('2026-10-22T02:00:00Z', now), false);
  assert.equal(canReply('2026-10-23T02:00:01Z', now), false);
  assert.equal(canReply(null, now), false); assert.equal(canReply('invalid', now), false);
});
