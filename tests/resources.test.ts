import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formToBody, resources, rowToForm, type Row } from '../src/modules/resources/config';
import { listFilter, parseUpdate } from '../src/modules/resources/rules';
import { describeEvent, eventHref } from '../src/modules/notifications';
const version = '2026-10-12T18:00:00.000Z';

test('buscar admite texto acotado, filtra estados válidos y oculta archivados por defecto', () => {
  const { query, where } = listFilter('prospectos', { q: '  Ana  ', status: 'CONTACTED' });
  assert.equal(query.q, 'Ana');
  assert.equal(where.archivedAt, null);
  assert.equal((where as { status?: string }).status, 'CONTACTED');
  assert.equal(listFilter('clientes', { archived: '1' }).where.archivedAt && 'not' in listFilter('clientes', { archived: '1' }).where.archivedAt!, true);
  assert.throws(() => listFilter('prospectos', { q: 'x'.repeat(101) }));
  assert.throws(() => listFilter('prospectos', { status: 'ADMIN' }));
  assert.throws(() => listFilter('clientes', { status: 'NEW' }), 'clientes no tiene estados');
  assert.throws(() => listFilter('clientes', { role: 'SUPERADMIN' }), 'parámetros desconocidos');
});

test('la búsqueda alcanza relaciones anidadas sin exponer otros campos', () => {
  const { where } = listFilter('pagos', { q: 'POL' });
  assert.deepEqual((where as { OR: unknown[] }).OR, [
    { policy: { number: { contains: 'POL', mode: 'insensitive' } } },
    { policy: { client: { name: { contains: 'POL', mode: 'insensitive' } } } },
  ]);
});

test('editar exige versión y limpia los campos opcionales omitidos', () => {
  assert.throws(() => parseUpdate('clientes', { name: 'Ana' }));
  assert.throws(() => parseUpdate('clientes', { name: 'Ana', expectedUpdatedAt: 'invalid' }));
  const client = parseUpdate('clientes', { name: ' Ana ', expectedUpdatedAt: version });
  assert.equal(client.expectedUpdatedAt.toISOString(), version);
  assert.deepEqual(client.data, { name: 'Ana', email: null, phone: null, taxId: null });
  const activity = parseUpdate('actividades', { title: 'Llamar', status: 'DONE', expectedUpdatedAt: version });
  assert.equal(activity.data.dueDate, null);
  assert.equal(activity.data.clientId, null);
  assert.equal(activity.data.status, 'DONE');
});

test('editar rechaza privilegios, campos ajenos y reglas de negocio inválidas', () => {
  assert.throws(() => parseUpdate('clientes', { name: 'Ana', expectedUpdatedAt: version, role: 'SUPERADMIN' }));
  assert.throws(() => parseUpdate('clientes', { name: 'Ana', expectedUpdatedAt: version, email: 'invalid' }));
  assert.throws(() => parseUpdate('prospectos', { name: 'Ana', expectedUpdatedAt: version, phone: '123' }));
  assert.throws(() => parseUpdate('prospectos', { name: 'Ana', expectedUpdatedAt: version, archivedAt: version }));
  assert.throws(() => parseUpdate('pagos', { policyId: 'p', amount: '10.00', dueDate: version, status: 'PAID', expectedUpdatedAt: version }), 'pagado sin fecha');
  assert.throws(() => parseUpdate('cotizaciones', { reference: 'Q', product: 'Auto', amount: '1.00', clientId: 'c', prospectId: 'p', expectedUpdatedAt: version }), 'dos destinatarios');
});

test('el formulario envía solo valores útiles, normaliza teléfono e importes y fechas en UTC', () => {
  const body = formToBody(resources.pagos, { policyId: 'p1', amount: '$1,250.50', currency: 'MXN', dueDate: '2026-03-01', status: 'PENDING', paidAt: '2026-03-02' });
  assert.deepEqual(body, { policyId: 'p1', amount: '1250.50', currency: 'MXN', dueDate: '2026-03-01T00:00:00.000Z', status: 'PENDING' }, 'paidAt oculto no se envía');
  assert.equal(formToBody(resources.pagos, { policyId: 'p1', amount: '1', currency: 'MXN', dueDate: '2026-03-01', status: 'PAID', paidAt: '2026-03-02' }).paidAt, '2026-03-02T00:00:00.000Z');
  assert.deepEqual(formToBody(resources.clientes, { name: ' Ana ', email: '', phone: '55 1234-5678', taxId: '' }), { name: 'Ana', phone: '5512345678' });
});

test('una ficha existente vuelve al formulario sin desplazar días ni inventar valores', () => {
  const row = { id: 'r', createdAt: version, updatedAt: version, policyId: 'p', amount: '10.00', currency: 'MXN', dueDate: '2026-03-01T00:00:00.000Z', paidAt: null, status: 'PENDING' } as Row;
  const form = rowToForm(resources.pagos, row);
  assert.equal(form.dueDate, '2026-03-01');
  assert.equal(form.paidAt, '');
  assert.equal(rowToForm(resources.prospectos, null).status, 'NEW', 'valores por defecto solo en altas');
});

test('cada módulo tiene título, columnas y estados con etiqueta', () => {
  for (const config of Object.values(resources)) {
    assert.ok(config.columns.length >= 1, config.slug);
    const status = config.fields.find(field => field.name === 'status');
    if (status) assert.deepEqual(status.options, config.statuses, config.slug);
    for (const name of config.nullable) assert.ok(config.fields.some(field => field.name === name), `${config.slug}.${name}`);
  }
});

test('las notificaciones describen la acción en español y no enlazan registros eliminados', () => {
  assert.equal(describeEvent({ action: 'uploaded', module: 'documentos', label: 'INE.pdf', actorName: 'Ana' }), 'Ana subió el archivo «INE.pdf»');
  assert.equal(describeEvent({ action: 'uploaded', module: 'documentos', label: 'INE.pdf', actorName: 'Ana' }, true), 'Subiste el archivo «INE.pdf»');
  assert.equal(eventHref({ action: 'deleted', module: 'clientes', recordId: 'c1' }), null);
  assert.equal(eventHref({ action: 'created', module: 'expedientes', recordId: 'c1' }), '/crm/clientes/c1');
  assert.equal(eventHref({ action: 'updated', module: 'pagos', recordId: 'x' }), '/crm/pagos');
});
