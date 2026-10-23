// Separate server-only test: node --conditions=react-server --import tsx --test tests/server/whatsapp-send.test.ts
// All persistence and provider calls are fake. No real message, database row or credential is used.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { replyWhatsApp, whatsappSending } from '../../src/modules/whatsapp/send';
import type { PrismaClient } from '../../src/generated/prisma/client';

test('WhatsApp sends: recipient isolation, idempotency, service window and ambiguous outcomes', async () => {
  const originalFetch = globalThis.fetch;
  const keys = ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_API_VERSION', 'DATABASE_URL'] as const;
  const originalEnv = keys.map(key => process.env[key]);
  const globalDb = globalThis as typeof globalThis & { ajDb?: PrismaClient };
  const previousDb = globalDb.ajDb;
  const actor = { id: 'fixture-admin', name: 'Equipo de prueba', email: null, role: 'ADMIN' as const };
  const rows: Record<string, unknown>[] = [];
  const conversation = { id: 'fixture-conversation', phoneNumberId: '123456789', contactId: '529991234567', lastInboundAt: new Date() };
  let calls = 0, mode = 'ok';
  const fake = {
    whatsAppConversation: { findUnique: async () => conversation, updateMany: async () => ({ count: 1 }) },
    whatsAppMessage: {
      findUnique: async ({ where }: { where: Record<string, unknown> }) => rows.find(row => Object.entries(where).every(([key, value]) => row[key] === value)) ?? null,
      count: async () => rows.filter(row => ['SENDING', 'UNKNOWN'].includes(String(row.status))).length,
      create: async ({ data }: { data: Record<string, unknown> }) => { const row = { ...data, id: `fixture-${rows.length}` }; rows.push(row); return row; },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => { const row = rows.find(row => row.id === where.id)!; Object.assign(row, data); return row; },
    },
    whatsAppReceipt: { findUnique: async () => null },
    crmEvent: { create: async () => ({}) },
    $queryRaw: async () => [{ id: conversation.id }],
    $transaction: async (callback: (db: unknown) => unknown) => callback(fake),
  };
  try {
    globalDb.ajDb = fake as unknown as PrismaClient;
    process.env.DATABASE_URL = 'postgresql://fixture:fixture@127.0.0.1/never-connect';
    process.env.WHATSAPP_ACCESS_TOKEN = 'fixture-not-a-real-token'; process.env.WHATSAPP_PHONE_NUMBER_ID = '123456789'; process.env.WHATSAPP_API_VERSION = 'v26.0';
    globalThis.fetch = async (url, init) => {
      calls++; assert.equal(String(url), 'https://graph.facebook.com/v26.0/123456789/messages');
      const sent = JSON.parse(String(init?.body)); assert.ok(sent.to === conversation.contactId || (mode.startsWith('mexico') && sent.to === '529991234567')); assert.equal(sent.type, 'text');
      if (mode.startsWith('mexico') && sent.to === '5219991234567') return Response.json({ error: { code: 131030 } }, { status: 400 });
      if (mode === 'mexico-timeout') throw new Error('fixture equivalent timeout');
      if (mode === 'timeout') throw new Error('fixture timeout');
      if (mode === 'rejected') return Response.json({ error: {} }, { status: 401 });
      if (mode === 'expired') return Response.json({ error: { code: 190, message: 'private token information' } }, { status: 400 });
      return Response.json({ messages: [{ id: `wamid.fixture-${calls}` }] });
    };
    assert.equal(whatsappSending(), true);
    const first = await replyWhatsApp(conversation.id, 'Respuesta de prueba', 'request-one', actor);
    assert.equal(first.status, 'ACCEPTED');
    await replyWhatsApp(conversation.id, 'Respuesta de prueba', 'request-one', actor);
    assert.equal(calls, 1, 'same request is not sent twice');
    await assert.rejects(replyWhatsApp(conversation.id, 'Changed text', 'request-one', actor), { code: 'WA_REQUEST_CONFLICT' });
    process.env.WHATSAPP_PHONE_NUMBER_ID = '987654321';
    await assert.rejects(replyWhatsApp(conversation.id, 'Other account', 'request-two', actor), { code: 'WA_SEND_NOT_CONFIGURED' });
    process.env.WHATSAPP_PHONE_NUMBER_ID = conversation.phoneNumberId;
    conversation.lastInboundAt = new Date(Date.now() - 25 * 3600000);
    await assert.rejects(replyWhatsApp(conversation.id, 'Closed', 'request-two', actor), { code: 'WA_WINDOW_CLOSED' });
    assert.equal(calls, 1);
    conversation.lastInboundAt = new Date(); mode = 'rejected';
    await assert.rejects(replyWhatsApp(conversation.id, 'Rejected', 'request-three', actor), { code: 'WA_SEND_REJECTED' });
    assert.equal(rows.at(-1)?.status, 'failed');
    mode = 'expired';
    await assert.rejects(replyWhatsApp(conversation.id, 'Expired', 'request-expired', actor), { code: 'WA_TOKEN_INVALID' });
    assert.equal(rows.at(-1)?.failureCode, 'META_190');
    await assert.rejects(replyWhatsApp(conversation.id, 'Expired', 'request-expired', actor), { code: 'WA_TOKEN_INVALID' });
    conversation.contactId = '5219991234567'; mode = 'mexico';
    const beforeMexico = calls;
    const mexico = await replyWhatsApp(conversation.id, 'Mexico equivalent', 'request-mexico', actor);
    assert.equal(mexico.status, 'ACCEPTED'); assert.equal(calls - beforeMexico, 2);
    assert.equal(conversation.contactId, '5219991234567', 'original identity is not rewritten');
    await replyWhatsApp(conversation.id, 'Mexico equivalent', 'request-mexico', actor);
    assert.equal(calls - beforeMexico, 2, 'same request does not send the alternative again');
    mode = 'timeout';
    await assert.rejects(replyWhatsApp(conversation.id, 'Uncertain', 'request-four', actor), { code: 'WA_DELIVERY_UNCERTAIN' });
    assert.equal(rows.at(-1)?.status, 'UNKNOWN');
    await assert.rejects(replyWhatsApp(conversation.id, 'Uncertain', 'request-four', actor), { code: 'WA_DELIVERY_UNCERTAIN' });
    await assert.rejects(replyWhatsApp(conversation.id, 'Another send', 'request-five', actor), { code: 'WA_DELIVERY_UNCERTAIN' });
    assert.equal(calls, 6, 'ambiguous requests and their conversation are not resent');
    // Reset the in-memory fixture only, to exercise the independent alternative-timeout scenario.
    rows.at(-1)!.status = 'failed'; mode = 'mexico-timeout';
    await assert.rejects(replyWhatsApp(conversation.id, 'Alternative uncertain', 'request-six', actor), { code: 'WA_DELIVERY_UNCERTAIN' });
    assert.equal(rows.at(-1)?.status, 'UNKNOWN');
    await assert.rejects(replyWhatsApp(conversation.id, 'Alternative uncertain', 'request-six', actor), { code: 'WA_DELIVERY_UNCERTAIN' });
    assert.equal(calls, 8, 'uncertain alternative is not tried again');
  } finally {
    globalThis.fetch = originalFetch; globalDb.ajDb = previousDb;
    keys.forEach((key, index) => { if (originalEnv[index] === undefined) delete process.env[key]; else process.env[key] = originalEnv[index]; });
  }
});
