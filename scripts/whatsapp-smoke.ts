import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import pg from 'pg';
// Read-only check against the real projected data. No business mutation, message or AI call.
const token = randomBytes(32).toString('hex'), secret = randomBytes(32).toString('hex');
const port = 33000 + Math.floor(Math.random() * 10000), base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', String(port)], {
  env: { ...process.env, AJ_API_TOKEN: token, WHATSAPP_APP_SECRET: secret, WHATSAPP_VERIFY_TOKEN: token, WHATSAPP_ACCESS_TOKEN: '' }, stdio: 'ignore',
});
const db = new pg.Client({ connectionString: process.env.DATABASE_URL || process.env.DATA_URL, connectionTimeoutMillis: 15000, query_timeout: 15000 });
const request = (path: string, init: RequestInit = {}, auth = true) => fetch(base + path, { ...init, headers: { ...(auth ? { Authorization: `Bearer ${token}` } : {}), ...init.headers }, signal: AbortSignal.timeout(30000), redirect: 'manual' });
let stage = 'startup';
try {
  let ready = false;
  for (let i = 0; i < 50; i++) { try { if ((await request('/api/health')).ok) { ready = true; break; } } catch {} await new Promise(resolve => setTimeout(resolve, 250)); }
  assert.equal(ready, true, 'local server starts'); stage = 'database'; await db.connect(); await db.query('BEGIN READ ONLY'); stage = 'inbox';
  const anon = await request('/api/whatsapp/conversations', {}, false); assert.ok([401,503].includes(anon.status));
  assert.ok([401,503].includes((await request('/api/whatsapp/connection', {}, false)).status));
  const connection = await request('/api/whatsapp/connection'); assert.equal(connection.status, 503); assert.equal((await connection.json()).error, 'WA_SEND_NOT_CONFIGURED');
  const response = await request('/api/whatsapp/conversations'); assert.equal(response.status, 200);
  const inbox = await response.json();
  assert.equal(inbox.total, 0);assert.equal(inbox.open,0);assert.deepEqual(inbox.rows,[],'una integración sin propietario no obtiene bandejas');
  assert.equal((await request('/api/whatsapp/conversations?skip=-1')).status, 400);
  const conversation = (await db.query('SELECT id FROM "WhatsAppConversation" LIMIT 1')).rows[0];
  stage = 'thread';
  if (conversation) {
    const thread = await request(`/api/whatsapp/conversations/${conversation.id}`); assert.equal(thread.status, 404);
    assert.equal((await request(`/api/whatsapp/conversations/${conversation.id}?cursor=unknown`)).status, 404);
    assert.equal((await request(`/api/whatsapp/conversations/${conversation.id}/reply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: 'never sent', requestId: 'invalid' }) })).status, 400);
    assert.ok([401,503].includes((await request(`/api/whatsapp/conversations/${conversation.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ closed: true }) }, false)).status));
  }
  stage = 'signature';
  const verified = await request(`/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${token}&hub.challenge=fixture`); assert.equal(await verified.text(), 'fixture');
  assert.equal((await request('/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=fixture')).status, 403);
  const before = (await db.query('SELECT count(*)::int AS n FROM "WebhookEvent"')).rows[0].n;
  assert.equal((await request('/api/whatsapp/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-hub-signature-256': 'sha256=' + '0'.repeat(64) }, body: '{}' }, false)).status, 401);
  const after = (await db.query('SELECT count(*)::int AS n FROM "WebhookEvent"')).rows[0].n; assert.equal(before, after);
  const duplicates = (await db.query('SELECT count(*)::int AS n FROM (SELECT "metaId" FROM "WhatsAppMessage" WHERE "metaId" IS NOT NULL GROUP BY "metaId" HAVING count(*) > 1) d')).rows[0].n; assert.equal(duplicates, 0);
  await db.query('ROLLBACK');
  console.log('WHATSAPP_INBOX_VERIFIED: unowned integration sees no conversations/counts, direct thread isolation, validation, verification challenge and signature rejection pass; no real message sent or business data changed. Human broker sessions: npm run brokers:smoke.');
} catch (error) { console.error('WHATSAPP_SMOKE_CHECK_FAILED', stage, error instanceof assert.AssertionError ? error.message : 'CONNECTION_OR_REQUEST_UNAVAILABLE'); process.exitCode = 1; }
finally { await db.end().catch(() => {}); server.kill(); }
