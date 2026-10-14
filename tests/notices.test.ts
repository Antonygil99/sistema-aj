import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDay, formatMoney, milestoneFor, noticeCandidates, noticeTiming, PAYMENT_GRACE_DAYS, PAYMENT_MILESTONES, RENEWAL_MILESTONES, staleNotices } from '../src/modules/email/notices';
import { BLANK, draftFor, fillTemplate, templateInfo, templateKinds, unknownPlaceholders } from '../src/modules/email/template-text';
import { dailyDigest } from '../src/modules/email/templates';
import { composeInput, noticeAction, templateInput } from '../src/modules/email/schema';

test('las renovaciones avisan a 30, 20 y 10 días y nunca después del vencimiento', () => {
  const at = (days: number) => milestoneFor(days, RENEWAL_MILESTONES);
  assert.deepEqual([31, 30, 21, 20, 11, 10, 5, 0, -1].map(at), [null, 30, 30, 20, 20, 10, 10, 10, null]);
});

test('los recibos avisan a 20 y 10 días, el día del vencimiento y hasta 3 días después', () => {
  const at = (days: number) => milestoneFor(days, PAYMENT_MILESTONES, PAYMENT_GRACE_DAYS);
  assert.deepEqual([21, 20, 15, 10, 1, 0, -3, -4].map(at), [null, 20, 20, 10, 10, 0, 0, null]);
});

test('los candidatos de hoy salen de pólizas, recibos y siniestros abiertos', () => {
  const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
  const list = noticeCandidates({
    today: '2026-10-14',
    policies: [
      { id: 'p1', clientId: 'c1', endDate: day('2026-10-24'), ownerEmail: 'ale@example.com', renewed: false },
      { id: 'p2', clientId: 'c2', endDate: day('2026-10-20'), ownerEmail: null, renewed: true },
      { id: 'p3', clientId: 'c3', endDate: day('2026-12-01'), ownerEmail: null, renewed: false },
    ],
    payments: [{ id: 'r1', policyId: 'p1', clientId: 'c1', dueDate: day('2026-10-13'), ownerEmail: 'ale@example.com' }],
    claims: [
      { id: 's1', policyId: 'p1', clientId: 'c1', createdAt: new Date('2026-09-29T18:00:00.000Z'), ownerEmail: null },
      { id: 's2', policyId: 'p1', clientId: 'c1', createdAt: new Date('2026-10-10T18:00:00.000Z'), ownerEmail: null },
    ],
  });
  assert.deepEqual(list.map(item => item.dedupeKey), ['RENOVACION:p1:10', 'PAGO:r1:0', 'SINIESTRO:s1:2']);
  assert.equal(list[1].policyId, 'p1');
});

test('un aviso pendiente se retira cuando su registro ya no aplica o un hito nuevo lo reemplaza', () => {
  const pending = [{ id: 'a', dedupeKey: 'RENOVACION:p1:20', kind: 'RENOVACION' }, { id: 'b', dedupeKey: 'PAGO:r1:0', kind: 'PAGO' }, { id: 'c', dedupeKey: 'SINIESTRO:s1:1', kind: 'SINIESTRO' }];
  const candidates = noticeCandidates({ today: '2026-10-14', policies: [{ id: 'p1', clientId: 'c1', endDate: new Date('2026-10-22T00:00:00.000Z'), ownerEmail: null, renewed: false }], payments: [], claims: [{ id: 's1', policyId: 'p1', clientId: 'c1', createdAt: new Date('2026-10-05T18:00:00.000Z'), ownerEmail: null }] });
  assert.deepEqual(staleNotices(pending, candidates).map(notice => notice.id), ['a', 'b']);
});

test('los textos del aviso dicen cuánto falta o desde cuándo está abierto', () => {
  assert.equal(noticeTiming('RENOVACION', 10, 8), 'Vence en 8 días');
  assert.equal(noticeTiming('PAGO', 0, 0), 'Vence hoy');
  assert.equal(noticeTiming('PAGO', 0, -1), 'Venció ayer');
  assert.equal(noticeTiming('PAGO', 0, -3), 'Venció hace 3 días');
  assert.equal(noticeTiming('SINIESTRO', 1, -7), 'Abierto hace 1 semana');
  assert.equal(formatDay('2026-11-15'), '15 de noviembre de 2026');
  assert.equal(formatMoney('1250.5', 'MXN'), '$1,250.50 MXN');
});

test('las plantillas llenan los datos, conservan los marcadores desconocidos y detectan huecos', () => {
  assert.equal(fillTemplate('Hola {cliente}, vence el {vence} ({otro})', { cliente: 'Ana', vence: '15 de noviembre' }), 'Hola Ana, vence el 15 de noviembre ({otro})');
  assert.deepEqual(unknownPlaceholders('{cliente} {clientes} {poliza} {x}'), ['clientes', 'x']);
  const saved = draftFor('PAGO', { subject: 'Pago  de {poliza}', body: 'Hola {cliente}' }, { cliente: 'Ana', poliza: 'P-1' });
  assert.deepEqual(saved, { subject: 'Pago de P-1', message: 'Hola Ana' });
  assert.ok(BLANK.test(templateInfo.SINIESTRO.defaults.body));
  for (const kind of templateKinds) {
    const { defaults, placeholders } = templateInfo[kind];
    assert.deepEqual(unknownPlaceholders(`${defaults.subject} ${defaults.body}`), [], kind);
    for (const name of [...`${defaults.subject} ${defaults.body}`.matchAll(/\{([a-z]+)\}/g)].map(match => match[1])) assert.ok((placeholders as string[]).includes(name), `${kind}: {${name}}`);
    assert.doesNotMatch(defaults.body, /cubre|garantiz|indemniz/i, kind);
  }
});

test('el resumen diario omite secciones vacías, escapa el contenido y cuenta lo que no cabe', () => {
  const digest = dailyDigest({ name: 'Ale Valencia', dayLabel: 'miércoles, 14 de octubre', appUrl: 'https://crm.segurosaleyjoel.com', sections: [
    { title: 'Tu agenda de hoy', items: [] },
    { title: 'Pólizas que vencen', items: [{ text: 'Ana <López> · MV-1', detail: 'Vence el 20 de octubre', url: 'https://crm.segurosaleyjoel.com/crm/polizas?open=1' }], more: 3 },
  ] });
  assert.equal(digest.subject, 'Tu día en Sistema AJ · miércoles, 14 de octubre');
  assert.ok(digest.html.includes('Buenos días, Ale.'));
  assert.ok(!digest.html.includes('Tu agenda de hoy'));
  assert.ok(digest.html.includes('Ana &lt;López&gt;'));
  assert.ok(digest.html.includes('y 3 más'));
  assert.ok(digest.text.includes('- Ana <López> · MV-1 (Vence el 20 de octubre)'));
});

test('los esquemas de la fase 2 validan plantillas, acciones y huecos sin completar', () => {
  assert.equal(templateInput.safeParse({ subject: 'Hola {cliente}', body: 'Vence {vence}' }).success, true);
  const unknown = templateInput.safeParse({ subject: 'Hola {nombre}', body: 'x' });
  assert.equal(unknown.success, false);
  assert.match(unknown.error!.issues[0].message, /\{nombre\}/);
  assert.equal(noticeAction.safeParse({ action: 'notified', channel: 'WHATSAPP', note: 'Confirmó' }).success, true);
  assert.equal(noticeAction.safeParse({ action: 'notified', channel: 'EMAIL' }).success, false);
  assert.equal(noticeAction.safeParse({ action: 'borrar' }).success, false);
  const base = { requestId: '7b0c6d1e-8f5a-4c2b-9d3e-1f2a3b4c5d6e', kind: 'SINIESTRO', clientId: 'c1', to: ['ana@example.com'], subject: 'Seguimiento', noticeId: 'n1' };
  assert.equal(composeInput.safeParse({ ...base, message: 'Va así: [escribe aquí el estado actual].' }).success, false);
  assert.equal(composeInput.safeParse({ ...base, message: 'Va en revisión con la aseguradora.' }).success, true);
});
