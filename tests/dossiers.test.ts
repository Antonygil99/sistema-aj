import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clientIssues, coverageState, dossierInput, makeSchedule, policyInput } from '../src/modules/clientes/dossier-policy';

const policy = { number: 'POL-1', insurer: 'Aseguradora', product: 'Auto', premium: 1000, currency: 'MXN', startDate: '2026-01-31', endDate: '2027-01-31', paymentFrequency: 'MONTHLY' };

test('el calendario reparte la prima en centavos y el último recibo absorbe el residuo', () => {
  const rows = makeSchedule(1000, 3, '2026-01-31', 'MONTHLY');
  assert.deepEqual(rows.map(r => r.amount), [333.33, 333.33, 333.34]);
  assert.equal(rows.reduce((sum, r) => sum + Math.round(r.amount * 100), 0), 100000);
});

test('pago único reemplaza cualquier cantidad anterior por un recibo con la prima completa', () => {
  assert.deepEqual(makeSchedule(11738.52, 12, '2026-09-24', 'ONCE'), [{ amount: 11738.52, dueDate: '2026-09-24' }]);
  assert.equal(policyInput.safeParse({ ...policy, premium: 11738.52, startDate: '2026-09-24', endDate: '2027-09-24', paymentFrequency: 'ONCE', payments: makeSchedule(11738.52, 12, '2026-09-24', 'ONCE') }).success, true);
});

test('los vencimientos mensuales respetan el fin de mes sin saltar al mes siguiente', () => {
  assert.deepEqual(makeSchedule(300, 3, '2026-01-31', 'MONTHLY').map(r => r.dueDate), ['2026-01-31', '2026-02-28', '2026-03-31']);
  assert.deepEqual(makeSchedule(200, 2, '2026-03-15', 'SEMIANNUAL').map(r => r.dueDate), ['2026-03-15', '2026-09-15']);
});

test('el calendario rechaza entradas inválidas sin lanzar errores', () => {
  assert.deepEqual(makeSchedule(0, 3, '2026-01-01', 'MONTHLY'), []);
  assert.deepEqual(makeSchedule(100, 0, '2026-01-01', 'MONTHLY'), []);
  assert.deepEqual(makeSchedule(100, 121, '2026-01-01', 'MONTHLY'), []);
  assert.deepEqual(makeSchedule(100, 2, '', 'MONTHLY'), []);
});

test('una póliza válida exige recibos que sumen la prima, ordenados y dentro de la vigencia', () => {
  const payments = makeSchedule(1000, 12, '2026-01-31', 'MONTHLY');
  assert.equal(policyInput.safeParse({ ...policy, payments }).success, true);
  assert.equal(policyInput.safeParse({ ...policy, payments: payments.slice(1) }).success, false, 'no suma la prima');
  assert.equal(policyInput.safeParse({ ...policy, payments: [...payments].reverse() }).success, false, 'desordenados');
  assert.equal(policyInput.safeParse({ ...policy, payments: [{ amount: 1000, dueDate: '2027-03-01' }] }).success, false, 'fuera de vigencia');
  assert.equal(policyInput.safeParse({ ...policy, endDate: policy.startDate, payments }).success, false, 'vigencia invertida');
  assert.equal(policyInput.safeParse({ ...policy, paymentFrequency: 'ONCE', payments }).success, false, 'pago único con varios recibos');
  assert.equal(policyInput.safeParse({ ...policy, premium: 10.005, payments: [{ amount: 10.005, dueDate: '2026-02-01' }] }).success, false, 'más de dos decimales');
});

test('el expediente acepta cliente sin póliza y rechaza campos desconocidos', () => {
  assert.equal(dossierInput.safeParse({ client: { name: 'Cliente de prueba' } }).success, true);
  assert.equal(dossierInput.safeParse({ client: { name: 'Cliente de prueba' }, extra: true }).success, false);
});

test('el estado de cobertura depende de la vigencia, no de los recibos', () => {
  const today = '2026-06-01';
  assert.equal(coverageState([], today), 'Por completar');
  assert.equal(coverageState([{ status: 'ACTIVE', startDate: '2026-01-01', endDate: '2026-12-31' }], today), 'Activo');
  assert.equal(coverageState([{ status: 'ACTIVE', startDate: '2026-07-01', endDate: '2027-06-30' }], today), 'Próxima vigencia');
  assert.equal(coverageState([{ status: 'CANCELLED', startDate: '2026-01-01', endDate: '2026-12-31' }], today), 'Sin póliza vigente');
  assert.equal(coverageState([{ status: 'ACTIVE', startDate: '2025-01-01', endDate: '2025-12-31' }], today), 'Sin póliza vigente');
});

test('el asistente explica en español qué dato del cliente corregir', () => {
  assert.deepEqual(clientIssues({ name: 'Ana' }), []);
  assert.deepEqual(clientIssues({ name: '' }), ['Escribe el nombre del cliente.']);
  assert.deepEqual(clientIssues({ name: 'Ana', email: 'no-es-correo', phone: '55 1234 5678' }), ['Revisa el correo electrónico.', 'Teléfono: de 8 a 15 dígitos, sin espacios; puede iniciar con +.']);
});
