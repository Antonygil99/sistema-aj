import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultPreferences, isViewKey, mergePreferences, preferencesPatch, readPreferences } from '../src/modules/preferences';
import { feedView } from '../src/modules/notifications';

test('las preferencias guardadas conservan solo valores válidos', () => {
  assert.deepEqual(readPreferences(null), defaultPreferences);
  const stored = { views: { clientes: 'list', documentos: 'mosaico', prospectos: 'board', otro: 'x' }, tours: { enabled: true, seen: ['modulo:pagos', 'modulo:pagos', 'MAL ID', 3] }, theme: 'neon', notifications: { team: false, toasts: 'no', clearedAt: 'ayer' }, assistantModel: 'gpt' };
  const read = readPreferences(stored);
  assert.deepEqual(read.views, { clientes: 'list', prospectos: 'board' });
  assert.deepEqual(read.tours, { enabled: true, seen: ['modulo:pagos'] });
  assert.equal(read.theme, 'light');
  assert.equal(read.notifications.team, false);
  assert.equal(read.notifications.toasts, true);
  assert.equal(read.notifications.clearedAt, null);
  assert.equal(read.assistantModel, 'claude-opus-5-5');
});

test('un cambio conserva el resto de las preferencias', () => {
  const current = readPreferences({ views: { clientes: 'list' }, tours: { enabled: true, seen: ['modulo:resumen'] }, theme: 'dark' });
  const next = mergePreferences(current, preferencesPatch.parse({ views: { documentos: 'grid' }, notifications: { payments: false } }));
  assert.deepEqual(next.views, { clientes: 'list', documentos: 'grid' });
  assert.equal(next.theme, 'dark');
  assert.equal(next.notifications.payments, false);
  assert.equal(next.notifications.team, true);
  assert.deepEqual(mergePreferences(next, { tours: { seen: [] } }).tours, { enabled: true, seen: [] });
  assert.deepEqual(mergePreferences(next, { resetViews: true }).views, {});
});

test('el API rechaza vistas, temas, modelos o campos desconocidos', () => {
  assert.equal(preferencesPatch.safeParse({ views: { clientes: 'mosaico' } }).success, false);
  assert.equal(preferencesPatch.safeParse({ views: { polizas: 'list' } }).success, false);
  assert.equal(preferencesPatch.safeParse({ theme: 'neon' }).success, false);
  assert.equal(preferencesPatch.safeParse({ theme: 'gradient' }).success, true);
  assert.equal(preferencesPatch.safeParse({ assistantModel: 'gpt-5' }).success, false);
  assert.equal(preferencesPatch.safeParse({ notifications: { sound: true } }).success, false);
  assert.equal(preferencesPatch.safeParse({ tours: { seen: ['<script>'] } }).success, false);
  assert.equal(preferencesPatch.safeParse({ theme: 'system', assistantModel: 'claude-sonnet-5-5', notifications: { clearedAt: '2026-10-13T18:00:00.000Z', clearedReminders: '2026-10-13:2-0-1' } }).success, true);
  assert.equal(isViewKey('prospectos'), true);
  assert.equal(isViewKey('toString'), false);
});

test('limpiar oculta lo visto y los recordatorios vuelven cuando cambian', () => {
  const settings = { ...defaultPreferences.notifications };
  const feed = { recent: [{ id: 'b', createdAt: '2026-10-13T18:05:00.000Z' }, { id: 'a', createdAt: '2026-10-13T17:00:00.000Z' }], reminders: { overduePayments: 2, renewalsThisWeek: 0, followUpsDue: 1 } };
  const before = feedView(feed, settings, '2026-10-13');
  assert.equal(before.events.length, 2);
  assert.equal(before.showReminders, true);
  const cleared = { ...settings, clearedAt: '2026-10-13T18:00:00.000Z', clearedReminders: before.reminderKey };
  const after = feedView(feed, cleared, '2026-10-13');
  assert.deepEqual(after.events.map(event => event.id), ['b']);
  assert.equal(after.showReminders, false);
  assert.equal(feedView({ ...feed, reminders: { ...feed.reminders, overduePayments: 3 } }, cleared, '2026-10-13').showReminders, true);
  assert.equal(feedView(feed, cleared, '2026-10-14').showReminders, true);
  const quiet = feedView(feed, { ...settings, team: false, payments: false, followUps: false }, '2026-10-13');
  assert.equal(quiet.events.length, 0);
  assert.equal(quiet.showReminders, false);
});
