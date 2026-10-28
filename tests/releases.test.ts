import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterReleases, releases, visibleReleases } from '../src/modules/help/releases';
import { canSeeTour, tourById } from '../src/modules/help/tours';

test('el historial mantiene fechas ordenadas, enlaces internos y recorridos válidos por rol', () => {
  const ids = new Set<string>();
  for (let index = 0; index < releases.length; index++) {
    const release = releases[index];
    assert.match(release.date, /^\d{4}-\d{2}-\d{2}$/);
    if (index) assert.ok(releases[index - 1].date >= release.date);
    assert.ok(!ids.has(release.id)); ids.add(release.id);
    for (const change of release.changes) {
      assert.ok(!ids.has(change.id)); ids.add(change.id);
      assert.ok(change.href.startsWith('/') && !change.href.startsWith('//'));
      if (change.tour) {
        const tour = tourById(change.tour); assert.ok(tour, `falta ${change.tour}`);
        assert.ok(canSeeTour(tour, change.minRole ?? 'USER'), `el rol de ${change.id} no puede iniciar su recorrido`);
      }
    }
  }
});
test('Novedades no entrega funciones de administración a quien solo consulta', () => {
  const user = visibleReleases('USER').flatMap(release => release.changes);
  assert.ok(!user.some(change => change.href === '/asistentes' || change.href === '/usuarios' || change.href === '/logs'));
  assert.ok(!user.some(change => change.id.startsWith('intake-')));
  assert.ok(visibleReleases('SUPERADMIN').flatMap(release => release.changes).length > user.length);
});
test('la búsqueda de novedades combina texto sin acentos con el tipo elegido', () => {
  const all = visibleReleases('SUPERADMIN');
  const matches = filterReleases(all, 'telefonos', 'fix').flatMap(release => release.changes);
  assert.equal(matches.length, 1);
  assert.ok(matches.every(change => change.kind === 'fix'));
  assert.ok(filterReleases(all, 'teléfonos', 'all').flatMap(release => release.changes).some(change => change.id === 'mexico-phone'));
  assert.deepEqual(filterReleases(all, 'no-existe-xyz', 'all'), []);
  assert.equal(filterReleases(all, '', 'all').length, all.length);
});
