import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { PrismaClient } from '../../src/generated/prisma/client';
import { syncCalendarPayments } from '../../src/modules/calendar/payments-server';
import { calendarGoogle } from '../../src/modules/calendar/google';
import { paymentEventId } from '../../src/modules/calendar/payment-event';

test('payment sync scopes the broker, retries without duplication, updates amounts, removes paid receipts and safely recreates reopened ones', async () => {
  const state = globalThis as typeof globalThis & { ajDb?: PrismaClient }, oldDb = state.ajDb;
  const oldUrl = process.env.DATABASE_URL, oldBase = process.env.BETTER_AUTH_URL;
  let role = 'USER', enabled = true, locked = false, paid = false, amount = '1200.55', inserts = 0, patches = 0, deletes = 0;
  const rows: Array<Record<string, unknown>> = [], events = new Map<string, Record<string, unknown>>();
  try {
    process.env.DATABASE_URL = 'postgresql://fixture:fixture@127.0.0.1/never-connect'; process.env.BETTER_AUTH_URL = 'https://crm.example.invalid';
    state.ajDb = {
      authUser: { findUnique: async () => ({ email: 'ale@example.invalid' }) }, accessGrant: { findUnique: async () => ({ enabled, role }) },
      calendarConnection: {
        updateMany: async ({ data }: { data: { renewalLeaseToken?: string | null } }) => ({ count: typeof data.renewalLeaseToken === 'string' && locked ? 0 : 1 }),
        findFirst: async () => ({ enabled: true }),
      },
      payment: { findMany: async ({ where }: { where: { archivedAt: null; status: unknown; policy: Record<string, unknown> } }) => {
        assert.deepEqual(where.policy.ownerEmail, { equals: 'ale@example.invalid', mode: 'insensitive' });
        assert.deepEqual(where.status, { in: ['PENDING', 'OVERDUE'] }); assert.equal(where.archivedAt, null);
        assert.deepEqual(where.policy.status, { not: 'CANCELLED' }); assert.equal(where.policy.archivedAt, null);
        return paid ? [] : [{ id: 'receipt', amount, currency: 'MXN', dueDate: new Date('2026-01-01'), status: 'OVERDUE', policy: { id: 'policy', number: '123', clientId: 'client', client: { name: 'Fixture' } } }];
      } },
      calendarPayment: {
        findMany: async ({ where }: { where: { userId: string } }) => { assert.equal(where.userId, 'ale'); return rows.map(row => ({ ...row })); },
        upsert: async ({ create, update }: { create: Record<string, unknown>; update: object }) => { if (!rows.length) rows.push({ ...create, generation: 0 }); else Object.assign(rows[0], update); return rows[0]; },
        update: async ({ data }: { data: Record<string, unknown> }) => { if (data.generation) data = { ...data, generation: Number(rows[0].generation) + 1 }; return Object.assign(rows[0], data); },
      },
    } as unknown as PrismaClient;
    const credentials = async (id: string) => { assert.equal(id, 'ale'); return calendarGoogle('fixture', async (url, options) => {
      const method = options?.method, id = new URL(String(url)).pathname.split('/').at(-1)!;
      if (method === 'POST') { const body = JSON.parse(String(options?.body)); assert.match(String(url), /sendUpdates=none/); events.set(body.id, body); inserts++; return Response.json(body); }
      if (method === 'PATCH') { const body = { ...events.get(id), ...JSON.parse(String(options?.body)) }; events.set(id, body); patches++; return Response.json(body); }
      if (method === 'DELETE') { events.delete(id); deletes++; return new Response(null, { status: 204 }); }
      return events.has(id) ? Response.json(events.get(id)) : Response.json({}, { status: 404 });
    }); };
    const sync = () => syncCalendarPayments('ale', undefined, undefined, credentials);
    await assert.rejects(sync(), { code: 'FORBIDDEN' }); role = 'ADMIN'; enabled = false;
    await assert.rejects(sync(), { code: 'FORBIDDEN' }); enabled = true; locked = true;
    assert.equal((await sync()).running, true); locked = false;
    assert.equal((await sync()).changed, 1); assert.equal((await sync()).changed, 0); assert.equal(inserts, 1);
    amount = '1250.25'; assert.equal((await sync()).changed, 1); assert.equal(patches, 1); assert.equal(inserts, 1);
    paid = true; assert.equal((await sync()).changed, 1); assert.equal(deletes, 1); assert.equal(events.size, 0);
    assert.equal((await sync()).changed, 0); assert.equal(deletes, 1);
    paid = false; await sync(); assert.equal(inserts, 2); assert.ok(events.has(paymentEventId('ale', 'receipt', 1)));
  } finally {
    state.ajDb = oldDb;
    if (oldUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = oldUrl;
    if (oldBase === undefined) delete process.env.BETTER_AUTH_URL; else process.env.BETTER_AUTH_URL = oldBase;
  }
});
