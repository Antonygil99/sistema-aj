import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contactQuerySchema, contactWhere } from '../src/modules/shared/contact-list';
import { clientUpdate, prospectUpdate } from '../src/modules/shared/contact-update';
const version = '2026-10-12T18:00:00.000Z';
test('buscar admite contacto y filtra estados válidos, sin aceptar entradas arbitrarias', () => {
  assert.deepEqual(contactQuerySchema.parse({ q: '  Ana  ' }), { q: 'Ana' });
  assert.throws(() => contactQuerySchema.parse({ q: 'x'.repeat(101) }));
  assert.throws(() => contactQuerySchema.parse({ status: 'ADMIN' }));
  assert.deepEqual(contactWhere({ q: '', status: 'CONTACTED' }, true), { status: 'CONTACTED' });
  assert.deepEqual(contactWhere({ q: '', status: 'CONTACTED' }, false), {});
});
test('editar exige versión y datos válidos, y permite limpiar campos opcionales', () => {
  assert.throws(() => clientUpdate({ name: 'Ana' }));
  assert.throws(() => clientUpdate({ name: 'Ana', expectedUpdatedAt: 'invalid' }));
  const client = clientUpdate({ name: ' Ana ', expectedUpdatedAt: version });
  assert.equal(client.expectedUpdatedAt.toISOString(), version);
  assert.deepEqual(client.data, { name: 'Ana', email: null, phone: null, taxId: null });
  const prospect = prospectUpdate({ name: 'Ana', status: 'CONTACTED', source: 'referido', expectedUpdatedAt: version });
  assert.equal(prospect.data.notes, null);
  assert.equal(prospect.data.status, 'CONTACTED');
});
test('editar rechaza campos de privilegios, relaciones y datos de contacto inválidos', () => {
  assert.throws(() => clientUpdate({ name: 'Ana', expectedUpdatedAt: version, role: 'SUPERADMIN' }));
  assert.throws(() => clientUpdate({ name: 'Ana', expectedUpdatedAt: version, email: 'invalid' }));
  assert.throws(() => prospectUpdate({ name: 'Ana', expectedUpdatedAt: version, phone: '123' }));
  assert.throws(() => prospectUpdate({ name: 'Ana', expectedUpdatedAt: version, clientId: 'existing' }));
});
