import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PrismaClient } from '../../src/generated/prisma/client';
import { confirmPayment } from '../../src/modules/polizas/finance-server';

test('manual confirmation stores the date and reviewer even without a receipt attachment', async () => {
  const oldUrl = process.env.DATABASE_URL;
  const globalDb = globalThis as typeof globalThis & { ajDb?: PrismaClient };
  const oldDb = globalDb.ajDb;
  process.env.DATABASE_URL = 'postgresql://test@127.0.0.1:1/mock';
  const receipt = {
    id: 'receipt', status: 'PENDING', policyId: 'policy', archivedAt: null,
    dueDate: new Date('2025-03-01'), amount: 100, currency: 'MXN',
    policy: {
      clientId: 'client', client: { archivedAt: null }, archivedAt: null, status: 'ACTIVE',
      premium: 100, currency: 'MXN', paymentFrequency: 'ONCE',
      startDate: new Date('2025-01-01'), endDate: new Date('2026-01-01'),
    },
  };
  const input = { expectedUpdatedAt: '2025-03-02T12:00:00Z', paidAt: '2025-03-01', reviewed: true };
  const actor = { id: 'broker', name: 'Broker de prueba', email: 'broker@example.invalid', role: 'ADMIN' as const };
  const updates: unknown[] = [], events: unknown[] = [], documents: string[] = [];
  let updateCount = 1;
  const tx = {
    $queryRaw: async () => [],
    payment: {
      findUnique: async () => receipt,
      findMany: async () => [receipt],
      updateMany: async ({ data }: { data: unknown }) => { updates.push(data); return { count: updateCount }; },
    },
    document: { findUnique: async ({ where }: { where: { id: string } }) => {
      documents.push(where.id);
      return { archivedAt: null, policyId: null, claimId: null, clientId: where.id === 'own' ? 'client' : 'other' };
    } },
    crmEvent: { create: async ({ data }: { data: unknown }) => { events.push(data); } },
  };
  globalDb.ajDb = { ...tx, $transaction: async (operation: (transaction: typeof tx) => unknown) => operation(tx) } as unknown as PrismaClient;
  try {
    await assert.rejects(confirmPayment('receipt', { ...input, reviewed: false }, actor));
    await assert.rejects(confirmPayment('receipt', { ...input, evidenceDocumentId: 'foreign' }, actor), { code: 'FINANCE_EVIDENCE_SCOPE' });
    await assert.rejects(confirmPayment('receipt', { ...input, evidenceDocumentId: 'drive:' }, actor), { code: 'FINANCE_EVIDENCE_SCOPE' });
    assert.deepEqual(updates, []);
    assert.deepEqual(events, []);

    await confirmPayment('receipt', input, actor);
    assert.deepEqual(documents, ['foreign']);
    assert.deepEqual(updates[0], { status: 'PAID', paidAt: new Date(input.paidAt), reference: null, evidenceDocumentId: null, evidenceDriveLinkId: null });
    assert.match((events[0] as { label: string }).label, /sin comprobante/);
    assert.equal((events[0] as { actorId: string }).actorId, actor.id);

    await confirmPayment('receipt', { ...input, evidenceDocumentId: 'own', reference: ' REF-123 ' }, actor);
    assert.deepEqual(updates[1], { status: 'PAID', paidAt: new Date(input.paidAt), reference: 'REF-123', evidenceDocumentId: 'own', evidenceDriveLinkId: null });
    updateCount = 0;
    await assert.rejects(confirmPayment('receipt', input, actor), { code: 'RECORD_CHANGED' });
    assert.equal(events.length, 2);
  } finally {
    if (oldUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = oldUrl;
    globalDb.ajDb = oldDb;
  }
});
