import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createResend, EmailError, resendConfiguration, sender } from '../src/integrations/resend/client';
import { agendaReminders, allowedRecipients, checkRecipients, nextStatus, reminderPlan, teamRecipients } from '../src/modules/email/rules';
import { agendaReminder, claimNotice, clientEmail, defaultClientMessage, escapeHtml } from '../src/modules/email/templates';
import { verifyWebhook } from '../src/modules/email/webhook';
import { composeInput, contactInput } from '../src/modules/email/schema';

const config = { apiKey: 're_prueba', from: 'avisos@segurosaleyjoel.com', webhookSecret: null };
function fakeFetch(status: number, body: unknown, calls: { url: string; init: RequestInit }[] = []) {
  return Object.assign(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  }, { calls }) as unknown as typeof fetch;
}

test('la configuración de Resend exige la llave y usa el remitente del dominio', () => {
  assert.equal(resendConfiguration({}), null);
  assert.deepEqual(resendConfiguration({ RESEND_API_KEY: ' re_x ' }), { apiKey: 're_x', from: 'avisos@segurosaleyjoel.com', webhookSecret: null });
  assert.equal(resendConfiguration({ RESEND_API_KEY: 're_x', RESEND_FROM_ADDRESS: 'hola@segurosaleyjoel.com', RESEND_WEBHOOK_SECRET: 'whsec_a' })?.from, 'hola@segurosaleyjoel.com');
  assert.equal(sender('avisos@segurosaleyjoel.com', 'Ale "Valencia" <x>\n'), '"Ale Valencia x" <avisos@segurosaleyjoel.com>');
});

test('el envío manda la llave de idempotencia, la respuesta al remitente, la programación y los adjuntos', async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const resend = createResend(config, fakeFetch(200, { id: 'em_1' }, calls));
  const id = await resend.send({ from: 'A <avisos@segurosaleyjoel.com>', to: ['cliente@example.com'], subject: 'Hola', html: '<p>Hola</p>', text: 'Hola', replyTo: 'ale@example.com', scheduledAt: '2026-10-20T16:00:00.000Z', idempotencyKey: 'email-1', attachments: [{ filename: 'poliza.pdf', content: 'JVBERi0=' }] });
  assert.equal(id, 'em_1');
  assert.equal(calls[0].url, 'https://api.resend.com/emails');
  const headers = calls[0].init.headers as Record<string, string>;
  assert.equal(headers.Authorization, 'Bearer re_prueba');
  assert.equal(headers['Idempotency-Key'], 'email-1');
  const body = JSON.parse(String(calls[0].init.body));
  assert.equal(body.reply_to, 'ale@example.com');
  assert.equal(body.scheduled_at, '2026-10-20T16:00:00.000Z');
  assert.equal(body.attachments[0].filename, 'poliza.pdf');
  await createResend(config, fakeFetch(200, {}, calls)).cancel('em_1');
  assert.equal(calls.at(-1)?.url, 'https://api.resend.com/emails/em_1/cancel');
});

test('los errores de Resend se traducen a códigos sin exponer su mensaje', async () => {
  const fail = (status: number) => createResend(config, fakeFetch(status, { message: 'cliente@example.com inválido' })).send({ from: 'a', to: ['b'], subject: 's', html: 'h', text: 't', idempotencyKey: 'k' });
  await assert.rejects(fail(429), (error: EmailError) => error.code === 'EMAIL_RATE_LIMITED' && !error.message.includes('@'));
  await assert.rejects(fail(401), (error: EmailError) => error.code === 'EMAIL_NOT_CONFIGURED' && error.status === 503);
  await assert.rejects(fail(422), (error: EmailError) => error.code === 'EMAIL_REJECTED');
  await assert.rejects(fail(500), (error: EmailError) => error.code === 'EMAIL_UNAVAILABLE');
  const offline = createResend(config, (async () => { throw new TypeError('fetch failed'); }) as unknown as typeof fetch);
  await assert.rejects(offline.send({ from: 'a', to: ['b'], subject: 's', html: 'h', text: 't', idempotencyKey: 'k' }), (error: EmailError) => error.code === 'EMAIL_UNAVAILABLE');
});

test('las plantillas escapan los datos del CRM y solo enlazan direcciones https', () => {
  assert.equal(escapeHtml('<b>"A&B"</b>'), '&lt;b&gt;&quot;A&amp;B&quot;&lt;/b&gt;');
  const email = clientEmail({ subject: ' Documentos ', message: 'Hola <script>alert(1)</script>\n\nSaludos', senderName: 'Ale Valencia', attachments: ['póliza <1>.pdf'], privacyUrl: 'javascript:alert(1)' });
  assert.equal(email.subject, 'Documentos');
  assert.ok(!email.html.includes('<script>'));
  assert.ok(email.html.includes('póliza &lt;1&gt;.pdf'));
  assert.ok(!email.html.includes('javascript:'));
  assert.ok(email.text.includes('Ale Valencia\nAJ Consultoría de Seguros'));
  assert.ok(clientEmail({ subject: 's', message: 'm', senderName: 'Ale', attachments: [], privacyUrl: 'https://segurosaleyjoel.com/privacidad' }).html.includes('aviso de privacidad'));
});

test('los textos sugeridos a clientes no prometen coberturas', () => {
  for (const kind of ['BIENVENIDA', 'DOCUMENTOS'] as const) {
    const { subject, message } = defaultClientMessage(kind, 'Ana López');
    assert.ok(message.startsWith('Hola Ana López:'));
    assert.ok(subject.length > 0);
    assert.doesNotMatch(message, /cubre|garantiz|cobertura total|indemniz/i);
  }
});

test('el aviso de siniestro no incluye la descripción y el recordatorio usa la hora de Ciudad de México', () => {
  const notice = claimNotice({ reference: 'SIN-1', policyNumber: 'P-9', clientName: 'Ana', occurredAt: '2026-10-10T00:00:00.000Z', url: 'https://crm.segurosaleyjoel.com/crm/siniestros?open=1' });
  assert.ok(notice.subject.includes('SIN-1'));
  const reminder = agendaReminder({ kind: 'AGENDA_1D', title: 'Revisión <póliza>', startAt: '2026-10-21T16:30:00.000Z', endAt: '2026-10-21T17:00:00.000Z', location: '', meetUrl: 'https://meet.google.com/abc-defg-hij', googleUrl: null, appUrl: 'https://crm.segurosaleyjoel.com' });
  assert.equal(reminder.subject, 'Mañana a las 10:30: Revisión <póliza>');
  assert.ok(reminder.html.includes('Revisión &lt;póliza&gt;'));
  assert.ok(reminder.html.includes('https://meet.google.com/abc-defg-hij'));
});

test('los recordatorios de agenda salen un día antes, a las 8:00 del día y 10 minutos antes', () => {
  const now = new Date('2026-10-14T15:00:00.000Z');
  const start = new Date('2026-10-17T16:30:00.000Z'); // sábado 10:30 en Ciudad de México
  assert.deepEqual(agendaReminders(start, now).map(item => [item.kind, item.at.toISOString()]), [
    ['AGENDA_1D', '2026-10-16T16:30:00.000Z'], ['AGENDA_DIA', '2026-10-17T14:00:00.000Z'], ['AGENDA_10M', '2026-10-17T16:20:00.000Z'],
  ]);
  // A las 8:30 el aviso de la mañana llegaría encima de la reunión: se omite.
  assert.deepEqual(agendaReminders(new Date('2026-10-17T14:30:00.000Z'), now).map(item => item.kind), ['AGENDA_1D', 'AGENDA_10M']);
  // Lo que ya pasó no se programa, ni lo que está fuera de la ventana de 30 días de Resend.
  assert.deepEqual(agendaReminders(new Date('2026-10-14T15:20:00.000Z'), now).map(item => item.kind), ['AGENDA_10M']);
  assert.deepEqual(agendaReminders(new Date('2026-12-01T16:00:00.000Z'), now), []);
});

test('el plan conserva lo que coincide y rehace lo que cambió de hora o de contenido', () => {
  const at = (iso: string) => new Date(iso);
  const desired = [{ kind: 'AGENDA_1D' as const, at: at('2026-10-16T16:30:00.000Z') }, { kind: 'AGENDA_10M' as const, at: at('2026-10-17T16:20:00.000Z') }];
  const existing = [
    { id: 'a', kind: 'AGENDA_1D', scheduledAt: at('2026-10-16T16:30:10.000Z'), version: 'v1' },
    { id: 'b', kind: 'AGENDA_10M', scheduledAt: at('2026-10-17T15:20:00.000Z'), version: 'v1' },
    { id: 'c', kind: 'AGENDA_DIA', scheduledAt: at('2026-10-17T14:00:00.000Z'), version: 'v1' },
  ];
  const plan = reminderPlan(existing, desired, 'v1');
  assert.deepEqual(plan.cancel.map(row => row.id), ['b', 'c']);
  assert.deepEqual(plan.create.map(item => item.kind), ['AGENDA_10M']);
  // Mismo horario pero otro título o lugar: el texto cambió, se rehace todo.
  const changed = reminderPlan(existing.slice(0, 1), desired.slice(0, 1), 'v2');
  assert.deepEqual([changed.cancel.map(row => row.id), changed.create.map(item => item.kind)], [['a'], ['AGENDA_1D']]);
  assert.deepEqual(reminderPlan(existing, [], 'v1').cancel.map(row => row.id), ['a', 'b', 'c']);
});

test('los eventos de Resend solo hacen avanzar el estado', () => {
  assert.equal(nextStatus('SENDING', 'email.sent'), 'SENT');
  assert.equal(nextStatus('SCHEDULED', 'email.delivered'), 'DELIVERED');
  assert.equal(nextStatus('DELIVERED', 'email.sent'), null);
  assert.equal(nextStatus('DELIVERED', 'email.complained'), 'COMPLAINED');
  assert.equal(nextStatus('SENT', 'email.bounced'), 'BOUNCED');
  assert.equal(nextStatus('CANCELLED', 'email.delivered'), null);
  assert.equal(nextStatus('SENT', 'email.opened'), null);
});

test('los avisos automáticos van al responsable o a los administradores, nunca a quien registró', () => {
  const grants = [
    { email: 'Ale@Example.com', role: 'ADMIN', enabled: true }, { email: 'joel@example.com', role: 'ADMIN', enabled: true },
    { email: 'tony@example.com', role: 'SUPERADMIN', enabled: true }, { email: 'consulta@example.com', role: 'USER', enabled: true },
    { email: 'baja@example.com', role: 'ADMIN', enabled: false },
  ];
  const all = () => true;
  assert.deepEqual(teamRecipients({ owner: 'joel@example.com', grants, actorEmail: null, wants: all }), ['joel@example.com']);
  assert.deepEqual(teamRecipients({ owner: null, grants, actorEmail: 'tony@example.com', wants: all }), ['ale@example.com', 'joel@example.com']);
  assert.deepEqual(teamRecipients({ owner: 'consulta@example.com', grants, actorEmail: null, wants: email => email !== 'joel@example.com' }), ['ale@example.com', 'tony@example.com']);
  assert.deepEqual(teamRecipients({ owner: 'ale@example.com', grants, actorEmail: 'ALE@example.com', wants: all }), []);
});

test('un correo a un cliente solo puede ir a su correo o a sus contactos registrados', () => {
  const allowed = allowedRecipients({ name: 'Ana', email: ' Ana@Example.com ' }, [{ name: 'RH', email: 'rh@empresa.com', role: 'RH' }, { name: 'Repetido', email: 'ana@example.com', role: '' }, { name: 'Sin correo', email: null, role: '' }, { name: 'Malo', email: 'no-es-correo', role: '' }]);
  assert.deepEqual(allowed.map(item => [item.email, item.label]), [['ana@example.com', 'Cliente'], ['rh@empresa.com', 'RH']]);
  assert.deepEqual(checkRecipients(['RH@empresa.com', 'rh@empresa.com'], allowed), { to: ['rh@empresa.com'], rejected: [] });
  assert.deepEqual(checkRecipients(['otra@persona.com'], allowed).rejected, ['otra@persona.com']);
});

test('la firma del webhook se verifica con el secreto, el cuerpo exacto y una marca de tiempo reciente', () => {
  const key = Buffer.from('clave-secreta-de-prueba');
  const secret = `whsec_${key.toString('base64')}`;
  const body = JSON.stringify({ type: 'email.delivered', data: { email_id: 'em_1' } });
  const now = Date.parse('2026-10-14T18:00:00.000Z');
  const timestamp = String(now / 1000);
  const signature = `v1,${createHmac('sha256', key).update(`msg_1.${timestamp}.${body}`).digest('base64')}`;
  assert.equal(verifyWebhook(secret, { id: 'msg_1', timestamp, signature: `v1,otra ${signature}` }, body, now), true);
  assert.equal(verifyWebhook(secret, { id: 'msg_1', timestamp, signature }, body.replace('em_1', 'em_2'), now), false);
  assert.equal(verifyWebhook(secret, { id: 'msg_1', timestamp, signature }, body, now + 10 * 60 * 1000), false);
  assert.equal(verifyWebhook(secret, { id: null, timestamp, signature }, body, now), false);
});

test('los esquemas validan el correo y los contactos', () => {
  const base = { requestId: '7b0c6d1e-8f5a-4c2b-9d3e-1f2a3b4c5d6e', kind: 'DOCUMENTOS', clientId: 'c1', to: ['ana@example.com'], subject: 'Hola', message: 'Texto', documentIds: ['d1', 'd1'] };
  assert.deepEqual(composeInput.parse(base).documentIds, ['d1']);
  assert.equal(composeInput.safeParse({ ...base, to: [] }).success, false);
  assert.equal(composeInput.safeParse({ ...base, bcc: ['x@y.com'] }).success, false);
  assert.deepEqual(contactInput.parse({ name: ' Laura ', email: 'Laura@Empresa.com', phone: '', role: 'RH' }), { name: 'Laura', email: 'laura@empresa.com', phone: null, role: 'RH' });
  assert.equal(contactInput.safeParse({ name: 'Sin datos', email: '', phone: '' }).success, false);
  assert.equal(contactInput.safeParse({ name: 'Tel', phone: '55 1234' }).success, false);
});
