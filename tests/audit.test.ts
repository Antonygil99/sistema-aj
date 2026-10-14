import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auditDetail, auditFilters, auditWhere } from '../src/modules/audit';

test('el historial valida acción, rol, fechas reales y paginación acotada', () => {
  for (const invalid of [{ action: 'invented' }, { role: 'OWNER' }, { module: 'authAccount' }, { from: '2026-02-30' }, { from: '2026-10-13', to: '2026-10-12' }, { page: 0 }, { page: 10001 }, { q: 'x'.repeat(121) }]) {
    assert.equal(auditFilters.safeParse(invalid).success, false);
  }
  assert.equal(auditFilters.parse({ action: '', role: '', from: '', to: '' }).page, 1);
});
test('el rango incluye el último día completo y filtra por el rol registrado', () => {
  const where = auditWhere(auditFilters.parse({ from: '2026-10-12', to: '2026-10-13', role: 'ADMIN', action: 'downloaded' }));
  assert.equal(where.createdAt?.gte?.toISOString(), '2026-10-12T06:00:00.000Z');
  assert.equal(where.createdAt?.lt?.toISOString(), '2026-10-14T06:00:00.000Z');
  assert.equal(where.actorRole, 'ADMIN');
  assert.equal(where.action, 'downloaded');
});
test('los permisos nuevos y heredados se explican sin exponer JSON interno', () => {
  assert.equal(auditDetail({ before: null, after: { role: 'USER', enabled: true } }), 'Sin acceso previo → Usuario · Activo');
  assert.equal(auditDetail({ before: { role: 'USER', enabled: true }, after: { role: 'ADMIN', enabled: false } }), 'Usuario · Activo → Administrador · Desactivado');
  assert.equal(auditDetail({ role: 'ADMIN', enabled: true }), 'Administrador · Activo');
  assert.equal(auditDetail({ secret: 'hidden' }), null);
});
test('la búsqueda incluye correo, nombre y registro sin distinguir mayúsculas', () => {
  const where = auditWhere(auditFilters.parse({ q: '  ADMIN@example.com  ' }));
  assert.deepEqual(where.OR?.[1], { actorEmail: { contains: 'ADMIN@example.com', mode: 'insensitive' } });
  assert.equal(where.OR?.length, 4);
  assert.deepEqual(auditWhere(auditFilters.parse({})), {});
});
