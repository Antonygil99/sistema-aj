import 'dotenv/config';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import pg from 'pg';

// Explicit integration check. Creates only two temporary records and removes them by id AND unique name.
// It never reads or alters a real user's session and never logs connection strings or tokens.
const connectionString = process.env.DATABASE_URL || process.env.DATA_URL;
if (!connectionString) throw new Error('DATABASE_NOT_CONFIGURED');
const runId = randomUUID();
const token = randomBytes(32).toString('hex');
const port = 32000 + Math.floor(Math.random() * 10000);
const base = `http://127.0.0.1:${port}`;
const names = { prospectos: `AJ verification prospect ${runId}`, clientes: `AJ verification client ${runId}` };
const database = new pg.Client({ connectionString, connectionTimeoutMillis: 15000 });
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', String(port)], { env: { ...process.env, AJ_API_TOKEN: token }, stdio: 'ignore' });
let serverFailure = false;
server.on('error', () => { serverFailure = true; });
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
async function request(path: string, method = 'GET', body?: unknown, authenticated = true) {
  return fetch(base + path, { method, headers: authenticated ? headers : { 'Content-Type': 'application/json', Origin: process.env.BETTER_AUTH_URL || base }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000) });
}
try {
  await database.connect();
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (serverFailure || server.exitCode !== null) throw new Error('SMOKE_SERVER_FAILED');
    try { if ((await fetch(base + '/api/health', { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; } } catch { /* server starting */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.equal(ready, true, 'server ready');
  for (const slug of ['prospectos', 'clientes'] as const) {
    const root = `/api/crm/${slug}`;
    assert.equal((await request(root, 'POST', { name: names[slug] }, false)).status, 401, 'anonymous mutation denied');
    const create = await request(root, 'POST', { name: names[slug], email: 'verification@example.invalid', phone: '+525555555555', ...(slug === 'prospectos' ? { source: 'verification' } : {}) });
    assert.equal(create.status, 201, 'create contact');
    let { data } = await create.json();
    const endpoint = root + '/' + data.id;
    assert.equal((await request(endpoint, 'PATCH', { name: names[slug], expectedUpdatedAt: data.updatedAt }, false)).status, 401, 'anonymous edit denied');
    const list = await request(root + '?q=' + encodeURIComponent(runId));
    const results = await list.json();
    assert.equal(results.data.some((row: { id: string }) => row.id === data.id), true, 'search finds new record');
    const expectedUpdatedAt = data.updatedAt;
    await new Promise(resolve => setTimeout(resolve, 5));
    const update = await request(endpoint, 'PATCH', { name: names[slug], expectedUpdatedAt, ...(slug === 'prospectos' ? { source: 'verification', status: 'CONTACTED' } : { taxId: 'VERIFICATION' }) });
    assert.equal(update.status, 200, 'edit contact');
    data = (await update.json()).data;
    assert.equal(data.email, null, 'clear email');
    assert.equal(data.phone, null, 'clear phone');
    assert.equal((await request(endpoint, 'PATCH', { name: names[slug], expectedUpdatedAt })).status, 409, 'stale edit denied');
    assert.equal((await request(endpoint)).status, 200, 'read detail');
    if (slug === 'prospectos') {
      const filtered = await request(root + '?q=' + runId + '&status=CONTACTED');
      assert.equal((await filtered.json()).total, 1, 'status filter');
    }
    const table = slug === 'prospectos' ? 'Prospect' : 'Client';
    const row = await database.query(`SELECT name,email,phone FROM "${table}" WHERE id=$1 AND name=$2`, [data.id, names[slug]]);
    assert.equal(row.rows.length, 1, 'database persistence');
    assert.equal(row.rows[0].email, null);
  }
  console.log('AJ_CRM_VERIFIED: create, search, edit, detail, optional-field clearing, stale-edit rejection and anonymous-access protection for prospects and clients.');
} catch {
  console.error('AJ_CRM_VERIFICATION_FAILED');
  process.exitCode = 1;
} finally {
  try {
    // Names contain a newly generated UUID; cleanup cannot match business records.
    await database.query('DELETE FROM "Prospect" WHERE name=$1 AND source=$2', [names.prospectos, 'verification']);
    await database.query('DELETE FROM "Client" WHERE name=$1', [names.clientes]);
    console.log('AJ_CRM_TEST_RECORDS_REMOVED');
  } catch { console.error('AJ_CRM_TEST_CLEANUP_FAILED'); process.exitCode = 1; }
  await database.end().catch(() => {});
  server.kill();
}
