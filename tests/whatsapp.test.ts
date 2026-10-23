import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWhatsApp, canReply, deliveryState } from '../src/modules/whatsapp/parse';
import { metaFailure, failureKey, storedFailure, messageFailure } from '../src/modules/whatsapp/errors';
import { mexicoAllowlistAlternative } from '../src/modules/whatsapp/recipient';
const envelope = (value: unknown, field = 'messages') => ({ entry: [{ changes: [{ field, value }] }] });
const metadata = { phone_number_id: '1435361196333698' };
const timestamp = '1792718480';
test('Mexican test recipient equivalent is bounded to the legacy 13-digit mobile format', () => {
  assert.equal(mexicoAllowlistAlternative('5219991234567'), '529991234567');
  for (const other of ['529991234567', '521234', '5210123456789', '15551234567', '5491123456789', '52199912345678']) assert.equal(mexicoAllowlistAlternative(other), null);
});
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
test('WhatsApp: only numeric provider errors survive; raw credentials, traces and messages never leave the parser', () => {
  const parsed = metaFailure({ error: { code: 190, message: 'private token and phone', fbtrace_id: 'private trace' } }, 400);
  assert.deepEqual(parsed, { code: 190, httpStatus: 400 });
  assert.equal(failureKey(parsed.code), 'WA_TOKEN_INVALID');
  assert.equal(messageFailure(storedFailure(131030, 400)), 'WA_RECIPIENT_NOT_ALLOWED');
  assert.equal(failureKey(133010), 'WA_NUMBER_NOT_REGISTERED');
  assert.equal(failureKey(10), 'WA_PERMISSION_MISSING');
  assert.equal(failureKey(131047), 'WA_WINDOW_CLOSED');
  assert.equal(storedFailure(metaFailure({ error: { code: '<script>private</script>' } }, 400).code, 400), 'HTTP_400');
  assert.equal(messageFailure('400'), 'WA_SEND_REJECTED');
});
