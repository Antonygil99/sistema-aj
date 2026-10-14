import { test } from 'node:test';
import assert from 'node:assert/strict';
import { modules } from '../src/modules/catalog';
import { preferencesPatch } from '../src/modules/preferences-schema';
import { canSeeTour, tourById, tourForPath, tours } from '../src/modules/help/tours';

test('cada módulo del menú tiene su recorrido guiado', () => {
  for (const entry of modules) {
    const tour = tourForPath(`/crm/${entry.slug}`);
    assert.ok(tour, `falta el recorrido de ${entry.slug}`);
    assert.equal(tour.id, `modulo:${entry.slug}`);
    assert.ok(tour.steps.length >= 2, `${entry.slug} necesita al menos dos pasos`);
  }
  assert.equal(tourForPath('/')?.id, 'modulo:resumen');
  assert.equal(tourForPath('/crm/clientes/nuevo')?.id, 'modulo:nuevo-expediente');
  assert.equal(tourForPath('/crm/clientes/ckabc123')?.id, 'modulo:expediente');
  assert.equal(tourForPath('/login'), null);
});

test('los recorridos se pueden marcar como vistos y sus textos son breves', () => {
  assert.equal(new Set(tours.map(tour => tour.id)).size, tours.length);
  assert.equal(preferencesPatch.safeParse({ tours: { seen: tours.map(tour => tour.id) } }).success, true);
  for (const tour of tours) for (const step of tour.steps) {
    assert.ok(step.title.length <= 60, `${tour.id}: título largo`);
    assert.ok(step.body.length <= 260, `${tour.id}: texto largo en «${step.title}»`);
  }
  for (const tour of tours.filter(item => item.kind === 'component')) assert.equal(tour.route, undefined);
});

test('los recorridos de administración respetan el rol', () => {
  const users = tourById('modulo:usuarios')!;
  assert.equal(canSeeTour(users, 'ADMIN'), false);
  assert.equal(canSeeTour(users, 'SUPERADMIN'), true);
  assert.equal(canSeeTour(tourById('modulo:nuevo-expediente')!, 'USER'), false);
  assert.equal(canSeeTour(tourById('modulo:pagos')!, 'USER'), true);
});
