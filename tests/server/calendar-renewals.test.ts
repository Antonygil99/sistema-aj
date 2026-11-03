import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { PrismaClient } from '../../src/generated/prisma/client';
import { syncCalendarRenewals } from '../../src/modules/calendar/renewals-server';
import { calendarGoogle } from '../../src/modules/calendar/google';

test('renewal sync enforces active admin, broker scope, connection lease, and stable idempotent persistence', async () => {
  const state = globalThis as typeof globalThis & { ajDb?: PrismaClient };
  const oldDb = state.ajDb, oldUrl = process.env.DATABASE_URL, oldBase = process.env.BETTER_AUTH_URL;
  let role = 'USER', enabled = true, locked = false, credentialsCalls = 0, inserts = 0;
  const rows: Array<Record<string, unknown>> = [];
  try {
    process.env.DATABASE_URL = 'postgresql://fixture:fixture@127.0.0.1/never-connect';
    process.env.BETTER_AUTH_URL = 'https://crm.example.invalid';
    state.ajDb = {
      authUser: { findUnique: async () => ({ email: 'ale@example.invalid' }) },
      accessGrant: { findUnique: async () => ({ enabled, role }) },
      calendarConnection: {
        updateMany: async ({ data }: { data: { renewalLeaseToken?: string | null } }) => ({ count: typeof data.renewalLeaseToken === 'string' && locked ? 0 : 1 }),
        findFirst: async () => ({ enabled: true }),
      },
      policy: { findMany: async ({ where }: { where: Record<string, unknown> }) => {
        assert.deepEqual(where.ownerEmail, { equals: 'ale@example.invalid', mode: 'insensitive' });
        assert.equal(where.status, 'ACTIVE'); assert.equal(where.archivedAt, null); assert.equal(where.nextPolicy, null);
        return [{ id: 'policy', number: '123', clientId: 'client', endDate: new Date('2099-12-31'), client: { name: 'Fixture' } }];
      } },
      calendarRenewal: {
        findMany: async ({ where }: { where: { userId: string } }) => { assert.equal(where.userId, 'ale'); return rows.map(row => ({ ...row })); },
        upsert: async ({ create }: { create: Record<string, unknown> }) => { if (!rows.length) rows.push({ ...create, generation: 0 }); return rows[0]; },
        update: async ({ data }: { data: Record<string, unknown> }) => Object.assign(rows[0], data),
      },
    } as unknown as PrismaClient;
    const credentials = async (userId: string) => { assert.equal(userId, 'ale'); credentialsCalls++; return calendarGoogle('fixture', async (_url, options) => {
      if (options?.method === 'POST') { inserts++; return Response.json({ id: JSON.parse(String(options.body)).id }); }
      return Response.json({}, { status: 404 });
    }); };
    await assert.rejects(syncCalendarRenewals('ale', undefined, undefined, credentials), { code: 'FORBIDDEN' });
    role = 'ADMIN'; enabled = false;
    await assert.rejects(syncCalendarRenewals('ale', undefined, undefined, credentials), { code: 'FORBIDDEN' });
    enabled = true; locked = true;
    assert.equal((await syncCalendarRenewals('ale', undefined, undefined, credentials)).running, true);
    assert.equal(credentialsCalls, 0);
    locked = false;
    assert.equal((await syncCalendarRenewals('ale', undefined, undefined, credentials)).changed, 1);
    assert.equal((await syncCalendarRenewals('ale', undefined, undefined, credentials)).changed, 0);
    assert.equal(inserts, 1);
  } finally {
    state.ajDb = oldDb;
    if (oldUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = oldUrl;
    if (oldBase === undefined) delete process.env.BETTER_AUTH_URL; else process.env.BETTER_AUTH_URL = oldBase;
  }
});
