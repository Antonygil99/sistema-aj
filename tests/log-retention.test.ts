import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authorizedCleanup, deleteExpiredLogs, logCutoff } from '../src/modules/log-retention';
test('la retención usa 72 horas exactas incluso al cambiar de mes', () => {
  assert.equal(logCutoff(new Date('2026-11-01T09:00:00Z')).toISOString(), '2026-10-29T09:00:00.000Z');
});
test('la tarea no permite ejecutar limpieza sin la credencial correcta', () => {
  const secret = 'cleanup-test-only';
  assert.equal(authorizedCleanup('Bearer ' + secret, secret), true);
  for (const value of [null, '', secret, 'Bearer wrong', 'Bearer ' + secret + 'extra']) assert.equal(authorizedCleanup(value, secret), false);
  assert.equal(authorizedCleanup('Bearer undefined', undefined), false);
  assert.equal(authorizedCleanup('Bearer ', ''), false);
});
test('solo elimina actividad y auditoría de accesos anteriores al corte; es idempotente', async () => {
  const now = new Date('2026-10-14T15:00:00Z');
  let events = [new Date('2026-10-11T14:59:59.999Z'), new Date('2026-10-11T15:00:00Z'), now];
  let access = [new Date('2026-10-10T00:00:00Z'), now];
  const tx = {
    crmEvent: { async deleteMany({ where }: { where: { createdAt: { lt: Date } } }) { const before = events.length; events = events.filter(date => date >= where.createdAt.lt); return { count: before - events.length }; } },
    accessAudit: { async deleteMany({ where }: { where: { createdAt: { lt: Date } } }) { const before = access.length; access = access.filter(date => date >= where.createdAt.lt); return { count: before - access.length }; } },
  };
  assert.deepEqual(await deleteExpiredLogs(tx, now), { events: 1, access: 1 });
  assert.equal(events.length, 2); assert.equal(access.length, 1);
  assert.deepEqual(await deleteExpiredLogs(tx, now), { events: 0, access: 0 });
});
