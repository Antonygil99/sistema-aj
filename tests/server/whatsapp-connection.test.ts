import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkWhatsAppConnection } from '../../src/modules/whatsapp/connection';
test('connection diagnosis is read-only, hides provider secrets and distinguishes missing, expired and readable access', async () => {
  const original = globalThis.fetch, keys = ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_API_VERSION'] as const;
  const saved = keys.map(key => process.env[key]); let calls = 0, mode = 'expired';
  try {
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    globalThis.fetch = async (url, init) => {
      calls++; assert.ok(!init?.method || init.method === 'GET');
      assert.equal(String(url), 'https://graph.facebook.com/v26.0/123456789?fields=id');
      assert.equal(String(url).includes('fixture-secret'), false);
      if (mode === 'timeout') throw new Error('fixture-secret must not be returned');
      if (mode === 'expired') return Response.json({ error: { code: 190, message: 'fixture-secret', fbtrace_id: 'private' } }, { status: 400 });
      return Response.json({ id: '123456789', private: 'fixture-secret' });
    };
    assert.equal((await checkWhatsAppConnection()).code, 'WA_SEND_NOT_CONFIGURED'); assert.equal(calls, 0);
    process.env.WHATSAPP_ACCESS_TOKEN = 'fixture-secret'; process.env.WHATSAPP_PHONE_NUMBER_ID = '123456789'; process.env.WHATSAPP_API_VERSION = 'v26.0';
    const expired = await checkWhatsAppConnection(); assert.equal(expired.code, 'WA_TOKEN_INVALID'); assert.equal(expired.metaCode, 190); assert.equal(JSON.stringify(expired).includes('fixture-secret'), false);
    mode = 'ok'; assert.deepEqual(await checkWhatsAppConnection(), { ok: true, code: 'WA_NUMBER_READABLE', metaCode: null });
    mode = 'timeout'; assert.deepEqual(await checkWhatsAppConnection(), { ok: false, code: 'WA_CONNECTION_UNAVAILABLE', metaCode: null });
  } finally { globalThis.fetch = original; keys.forEach((key, i) => { if (saved[i] === undefined) delete process.env[key]; else process.env[key] = saved[i]; }); }
});
