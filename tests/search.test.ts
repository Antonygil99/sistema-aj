import { test } from 'node:test';
import assert from 'node:assert/strict';
import { documentResult, folderResult, groupResults, resourceResult, searchQuery, userResult } from '../src/modules/search';
import type { Row } from '../src/modules/resources/config';
const base = { createdAt: '2026-10-12T00:00:00.000Z', updatedAt: '2026-10-12T00:00:00.000Z' };

test('los clientes abren su expediente y las demás tablas abren la ficha filtrada', () => {
  assert.equal(resourceResult('clientes', { ...base, id: 'c 1', name: 'Ana' } as Row).href, '/crm/clientes/c%201');
  const policy = resourceResult('polizas', { ...base, id: 'p1', number: 'GNP-01', insurer: 'GNP', product: 'Auto', premium: '10.00', currency: 'MXN', startDate: base.createdAt, endDate: base.createdAt, client: { name: 'Ana' } } as Row);
  assert.equal(policy.title, 'GNP-01');
  assert.equal(policy.href, '/crm/polizas?q=GNP-01&open=p1');
  assert.match(policy.subtitle, /GNP · Auto/);
});

test('recibos y renovaciones se vuelven a encontrar por número de póliza', () => {
  const receipt = resourceResult('pagos', { ...base, id: 'r1', amount: '5.00', currency: 'MXN', dueDate: base.createdAt, policy: { number: 'AXA 9', client: { name: 'Luis' } } } as Row);
  assert.equal(receipt.href, '/crm/pagos?q=AXA%209&open=r1');
});

test('archivos se descargan, carpetas abren su biblioteca y usuarios llevan a accesos', () => {
  const file = documentResult({ id: 'd1', name: 'INE.pdf', mimeType: 'application/pdf', client: { name: 'Ana' } });
  assert.equal(file.download, true);
  assert.equal(file.href, '/api/documents/d1/download');
  assert.equal(folderResult({ id: 'f1', name: 'Pagos', clientId: 'c1', client: { name: 'Ana' } }).href, '/crm/documentos?folder=f1&clientId=c1');
  assert.equal(folderResult({ id: 'f2', name: 'General', clientId: null }).href, '/crm/documentos?folder=f2');
  assert.equal(userResult({ id: 'u', email: 'a@b.mx', role: 'ADMIN', enabled: false, name: null }).subtitle, 'Administrador · Desactivado');
});

test('la consulta se recorta y los grupos siguen un orden estable sin grupos vacíos', () => {
  assert.equal(searchQuery('  hola  '), 'hola');
  assert.equal(searchQuery('x'.repeat(150)).length, 100);
  assert.equal(searchQuery(null), '');
  const groups = groupResults([userResult({ id: 'u', email: 'a@b.mx', role: 'USER', enabled: true }), resourceResult('clientes', { ...base, id: 'c', name: 'Ana' } as Row)]);
  assert.deepEqual(groups.map(group => group.label), ['Clientes', 'Usuarios y accesos']);
});
