import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultPreferences, isViewKey, mergePreferences, preferencesPatch, readPreferences } from '../src/modules/preferences';

test('las preferencias guardadas conservan solo valores válidos', () => {
  assert.deepEqual(readPreferences(null), defaultPreferences);
  const stored = { views: { clientes: 'list', documentos: 'mosaico', prospectos: 'board', otro: 'x' }, tours: { enabled: true, seen: ['modulo:pagos', 'modulo:pagos', 'MAL ID', 3] } };
  assert.deepEqual(readPreferences(stored), { views: { clientes: 'list', prospectos: 'board' }, tours: { enabled: true, seen: ['modulo:pagos'] } });
});

test('un cambio de vista conserva las demás y el estado de los recorridos', () => {
  const current = readPreferences({ views: { clientes: 'list' }, tours: { enabled: true, seen: ['modulo:resumen'] } });
  const next = mergePreferences(current, preferencesPatch.parse({ views: { documentos: 'grid' } }));
  assert.deepEqual(next, { views: { clientes: 'list', documentos: 'grid' }, tours: { enabled: true, seen: ['modulo:resumen'] } });
  assert.deepEqual(mergePreferences(next, { tours: { seen: [] } }).tours, { enabled: true, seen: [] });
});

test('el API rechaza vistas, módulos o campos desconocidos', () => {
  assert.equal(preferencesPatch.safeParse({ views: { clientes: 'mosaico' } }).success, false);
  assert.equal(preferencesPatch.safeParse({ views: { polizas: 'list' } }).success, false);
  assert.equal(preferencesPatch.safeParse({ theme: 'dark' }).success, false);
  assert.equal(preferencesPatch.safeParse({ tours: { seen: ['<script>'] } }).success, false);
  assert.equal(isViewKey('prospectos'), true);
  assert.equal(isViewKey('toString'), false);
});
