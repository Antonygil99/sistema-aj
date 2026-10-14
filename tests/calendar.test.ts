import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CalendarError, hasCalendarScope, meetingInput, calendarInputToIso, localCalendarInput, type CalendarEntry } from '../src/modules/calendar/schema';
import { calendarGoogle, eventBody, safeGoogleLink } from '../src/modules/calendar/google';
import { meetingId, meetingService, type MeetingRepository } from '../src/modules/calendar/service';

const input = meetingInput.parse({ requestId: 'aa000000-0000-4000-8000-000000000000', title: 'Seguimiento', startAt: '2026-10-15T09:00:00-06:00', endAt: '2026-10-15T09:30:00-06:00' });
function repository() {
  const rows = new Map<string, CalendarEntry & { userId: string }>();
  const repo: MeetingRepository = {
    async reserve(userId, id, data) {
      if (!rows.has(id)) { const { requestId, ...fields } = data; void requestId; rows.set(id, { ...fields, id, userId, status: 'PENDING', googleUrl: null, meetUrl: null }); }
      return structuredClone(rows.get(id)!);
    },
    async find(userId, id) { const row = rows.get(id); return row?.userId === userId ? structuredClone(row) : null; },
    async confirm(userId, id, googleUrl, meetUrl) { const row = rows.get(id); if (row?.userId !== userId || row.status !== 'PENDING') return false; Object.assign(row, { status: 'SYNCED', googleUrl, meetUrl }); return true; },
    async failCreation(userId, id) { const row = rows.get(id); if (row?.userId === userId && row.status === 'PENDING') row.status = 'FAILED'; },
    async markCancelling(userId, id) { const row = rows.get(id); if (row?.userId === userId && ['SYNCED','FAILED'].includes(row.status)) row.status = 'CANCEL_PENDING'; },
    async finishCancelled(userId, id) { const row = rows.get(id); if (row?.userId !== userId || row.status !== 'CANCEL_PENDING') return false; row.status = 'CANCELLED'; return true; },
  };
  return { repo, rows };
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
test('la agenda valida fechas, invitados, recordatorios y no acepta identidades del cliente', () => {
  for (const patch of [{ userId: 'other' }, { endAt: input.startAt }, { endAt: '2026-10-30T00:00:00Z' }, { attendees: ['invalid'] }, { attendees: Array.from({ length: 21 }, (_, i) => `guest${i}@example.com`) }, { reminderMinutes: 40321 }, { reminderMinutes: -1 }, { requestId: 'unsafe' }]) assert.equal(meetingInput.safeParse({ ...input, ...patch }).success, false);
  assert.deepEqual(meetingInput.parse({ ...input, attendees: ['GUEST@example.com','guest@example.com'] }).attendees, ['guest@example.com']);
});
test('la captura y visualización conservan la hora CDMX y los scopes se comprueban completos', () => {
  assert.equal(calendarInputToIso('2026-10-15T09:00'), '2026-10-15T15:00:00.000Z');
  assert.equal(localCalendarInput('2026-10-15T15:00:00.000Z'), '2026-10-15T09:00');
  assert.equal(hasCalendarScope('openid,https://www.googleapis.com/auth/calendar.events.owned'), true);
  assert.equal(hasCalendarScope('https://www.googleapis.com/auth/calendar.events.owned.readonly'), false);
});
test('Google recibe recordatorio y Meet; las invitaciones se envían solo cuando se solicita', async () => {
  let requested = '';
  const transport: typeof fetch = async (url, options) => { requested = String(url); assert.equal(new Headers(options?.headers).get('authorization'), 'Bearer server-token'); return json({ id: 'event' }); };
  const body = eventBody({ ...input, reminderMinutes: 15, reminderMethod: 'email', googleMeet: true }, 'abc123');
  assert.equal(body.start.timeZone, 'America/Mexico_City');
  assert.deepEqual(body.reminders.overrides, [{ method: 'email', minutes: 15 }]);
  assert.equal(body.conferenceData?.createRequest.requestId, 'abc123');
  await calendarGoogle('server-token', transport).insert(input, 'abc123');
  assert.match(requested, /sendUpdates=none/);
  await calendarGoogle('server-token', transport).insert({ ...input, notifyGuests: true }, 'abc123');
  assert.match(requested, /sendUpdates=all/);
});
test('dos usuarios tienen IDs distintos y no pueden consultar ni cancelar reuniones ajenas', async () => {
  const { repo } = repository();
  const google = calendarGoogle('token', async () => json({ id: 'event' }));
  const service = meetingService(repo, google);
  const created = await service.create('user-a', input);
  assert.notEqual(meetingId('user-a', input.requestId), meetingId('user-b', input.requestId));
  assert.equal(await repo.find('user-b', created.entry.id), null);
  await assert.rejects(service.cancel('user-b', created.entry.id), { code: 'CALENDAR_EVENT_NOT_FOUND' });
});
test('reintentar después de perder la confirmación de la base no duplica el evento ni las invitaciones', async () => {
  const { repo } = repository();
  let inserted = false, posts = 0, invitations = 0;
  const transport: typeof fetch = async (url, options) => {
    if (options?.method === 'POST') {
      posts++;
      if (inserted) return json({}, 409);
      inserted = true; invitations++;
    }
    const id = options?.method === 'POST' ? JSON.parse(String(options.body)).id : String(url).split('/').at(-1);
    return json({ id, htmlLink: 'https://calendar.google.com/calendar/event?eid=test', extendedProperties: { private: { sistemaAjId: id } } });
  };
  const originalConfirm = repo.confirm;
  let databaseFailed = false;
  repo.confirm = async (...args) => { if (!databaseFailed) { databaseFailed = true; throw new Error('DATABASE_TEMPORARY'); } return originalConfirm(...args); };
  const service = meetingService(repo, calendarGoogle('token', transport));
  await assert.rejects(service.create('user', { ...input, notifyGuests: true }), /DATABASE_TEMPORARY/);
  const result = await service.create('user', { ...input, notifyGuests: true });
  assert.equal(result.entry.status, 'SYNCED');
  assert.equal(result.changed, true);
  assert.equal(posts, 2);
  assert.equal(invitations, 1);
  assert.equal((await service.create('user', { ...input, notifyGuests: true })).changed, false);
  assert.equal(posts, 2);
  await assert.rejects(service.create('user', { ...input, title: 'Changed', notifyGuests: true }), { code: 'CALENDAR_EVENT_CHANGED' });
});
test('la colisión con un evento ajeno no lo sobrescribe', async () => {
  const transport: typeof fetch = async (_url, options) => options?.method === 'POST' ? json({}, 409) : json({ id: 'abc', extendedProperties: { private: { sistemaAjId: 'someone-else' } } });
  await assert.rejects(calendarGoogle('token', transport).insert(input, 'abc'), { code: 'CALENDAR_EVENT_CHANGED' });
});
test('cancelar un evento ya eliminado de Google termina sin fallar ni repetir la cancelación', async () => {
  const { repo } = repository();
  let deletes = 0;
  const transport: typeof fetch = async (_url, options) => {
    if (options?.method === 'DELETE') { deletes++; return json({}, 410); }
    return json({ id: 'event' });
  };
  const service = meetingService(repo, calendarGoogle('token', transport));
  const { entry } = await service.create('user', input);
  const cancelled = await service.cancel('user', entry.id);
  assert.equal(cancelled.entry.status, 'CANCELLED');
  assert.equal((await service.cancel('user', entry.id)).changed, false);
  assert.equal(deletes, 1);
  await assert.rejects(service.create('user', input), { code: 'CALENDAR_EVENT_CHANGED' });
});
test('los errores transitorios conservan el intento y los rechazos definitivos permiten descartarlo', async () => {
  const { repo } = repository();
  let status = 503;
  const service = meetingService(repo, calendarGoogle('token', async () => json({ error: { message: 'provider-private-error' } }, status)));
  await assert.rejects(service.create('user', input), { code: 'CALENDAR_UNAVAILABLE' });
  const id = meetingId('user', input.requestId);
  assert.equal((await repo.find('user', id))?.status, 'PENDING');
  status = 400;
  await assert.rejects(service.create('user', input), { code: 'CALENDAR_EVENT_INVALID' });
  assert.equal((await repo.find('user', id))?.status, 'FAILED');
  assert.equal((await service.cancel('user', id)).entry.status, 'CANCELLED');
});
test('errores de permisos y cuota no exponen la respuesta ni las credenciales de Google', async () => {
  for (const [status, body, code] of [[401, {}, 'CALENDAR_RECONNECT'], [403, { error: { errors: [{ reason: 'userRateLimitExceeded' }] } }, 'CALENDAR_RATE_LIMIT'], [403, {}, 'CALENDAR_PERMISSION'], [429, {}, 'CALENDAR_RATE_LIMIT']] as const) {
    await assert.rejects(calendarGoogle('private-token', async () => json(body, status)).verify(), error => error instanceof CalendarError && error.code === code && error.message === code);
  }
});
test('solo se muestran enlaces HTTPS de Google Calendar y Google Meet', () => {
  assert.equal(safeGoogleLink('javascript:alert(1)'), null);
  assert.equal(safeGoogleLink('https://calendar.google.com.attacker.com/event'), null);
  assert.equal(safeGoogleLink('https://user:pass@calendar.google.com/event'), null);
  assert.equal(safeGoogleLink('https://meet.google.com/abc-defg-hij', true), 'https://meet.google.com/abc-defg-hij');
});
