import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compactMoney, delta, monthRange, ratio } from '../src/modules/metrics/period';

test('el mes se cuenta en hora de la Ciudad de México (UTC-6)', () => {
  // 1 de noviembre a las 02:00 UTC todavía es 31 de octubre en CDMX.
  const late = monthRange(new Date('2026-11-01T02:00:00Z'));
  assert.equal(late.label, 'octubre 2026');
  assert.equal(late.start.toISOString(), '2026-10-01T06:00:00.000Z');
  assert.equal(late.end.toISOString(), '2026-11-01T06:00:00.000Z');
  assert.equal(late.prevStart.toISOString(), '2026-09-01T06:00:00.000Z');
  assert.equal(late.previousLabel, 'septiembre');
  assert.equal(late.today.toISOString(), '2026-10-31T00:00:00.000Z');
});

test('enero compara contra diciembre del año anterior', () => {
  const january = monthRange(new Date('2027-01-15T18:00:00Z'));
  assert.equal(january.prevStart.toISOString(), '2026-12-01T06:00:00.000Z');
  assert.equal(january.previousLabel, 'diciembre');
});

test('la variación se expresa con signo y texto, nunca solo con color', () => {
  assert.deepEqual(delta(5, 2, 'septiembre'), { direction: 'up', text: '+3 vs septiembre' });
  assert.deepEqual(delta(1, 4, 'septiembre'), { direction: 'down', text: '−3 vs septiembre' });
  assert.deepEqual(delta(2, 2, 'septiembre'), { direction: 'same', text: 'Igual que en septiembre' });
});

test('los porcentajes no dividen entre cero y los importes grandes se compactan', () => {
  assert.equal(ratio(3, 4), 75);
  assert.equal(ratio(0, 0), null);
  assert.equal(compactMoney(14850), '$14,850');
  assert.match(compactMoney(1250000), /1\.3\s?M/);
});
