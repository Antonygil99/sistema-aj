import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deliveryInput } from '../src/modules/polizas/delivery-schema';
import { checklist, completedChecks, deliveryStage, followUpSchedule, isComplete, nextFollowUp, type DeliveryState } from '../src/modules/polizas/delivery';
const none = Object.fromEntries(checklist.map(item => [item.field, false])) as Omit<DeliveryState, 'deliveredAt' | 'referralPotential'>;
const all = Object.fromEntries(checklist.map(item => [item.field, true])) as Omit<DeliveryState, 'deliveredAt' | 'referralPotential'>;
const delivered = '2026-10-01T00:00:00.000Z';
const doneFollowUp = (kind: string) => ({ kind, status: 'DONE', dueDate: delivered });

test('la póliza avanza por las etapas del tablero según entrega, checklist y seguimientos', () => {
  assert.equal(deliveryStage({ ...none, deliveredAt: null, referralPotential: false }, []), 'EMITIDA');
  assert.equal(deliveryStage({ ...none, deliveryReceived: true, deliveredAt: delivered, referralPotential: false }, []), 'ENTREGADA');
  assert.equal(deliveryStage({ ...all, deliveredAt: delivered, referralPotential: false }, []), 'EXPLICADA');
  assert.equal(deliveryStage({ ...all, deliveredAt: delivered, referralPotential: false }, [doneFollowUp('SEGUIMIENTO_7')]), 'SEGUIMIENTO_7');
  assert.equal(deliveryStage({ ...all, deliveredAt: delivered, referralPotential: false }, [doneFollowUp('SEGUIMIENTO_7'), doneFollowUp('SEGUIMIENTO_30')]), 'SEGUIMIENTO_30');
  assert.equal(deliveryStage({ ...all, deliveredAt: delivered, referralPotential: true }, [doneFollowUp('SEGUIMIENTO_7'), doneFollowUp('SEGUIMIENTO_30')]), 'REFERIDO');
});

test('marcar posible referido antes de generar confianza no salta etapas', () => {
  assert.equal(deliveryStage({ ...all, deliveredAt: delivered, referralPotential: true }, []), 'EXPLICADA');
});

test('solo los cinco puntos completan la póliza', () => {
  assert.equal(isComplete({ ...all, deliveryKnowsFirstStep: false, deliveredAt: delivered, referralPotential: false }), false);
  assert.equal(completedChecks({ ...none, deliveryReceived: true, deliveryUnderstood: true, deliveredAt: delivered, referralPotential: false }), 2);
  assert.equal(isComplete({ ...all, deliveredAt: delivered, referralPotential: false }), true);
});

test('los seguimientos caen a 7, 30 y 90 días naturales de la entrega', () => {
  const schedule = followUpSchedule('2026-10-01T18:30:00.000Z');
  assert.deepEqual(schedule.map(item => item.dueDate.toISOString().slice(0, 10)), ['2026-10-08', '2026-10-31', '2026-12-30']);
});

test('el siguiente seguimiento es el primero pendiente y se marca vencido si su fecha pasó', () => {
  const items = [{ kind: 'SEGUIMIENTO_7', status: 'DONE', dueDate: '2026-10-08T00:00:00.000Z' }, { kind: 'SEGUIMIENTO_30', status: 'PENDING', dueDate: '2026-10-31T00:00:00.000Z' }, { kind: 'SEGUIMIENTO_90', status: 'PENDING', dueDate: '2026-12-30T00:00:00.000Z' }];
  assert.deepEqual(nextFollowUp(items, '2026-11-02'), { kind: 'SEGUIMIENTO_30', label: 'Seguimiento de uso · 30 días', dueDate: '2026-10-31', overdue: true });
  assert.equal(nextFollowUp(items, '2026-10-20')?.overdue, false);
  assert.equal(nextFollowUp([], '2026-10-20'), null);
});

test('la actualización exige versión, fecha de entrega antes del checklist y no acepta campos ajenos', () => {
  const checks = Object.fromEntries(checklist.map(item => [item.field, false]));
  const base = { expectedUpdatedAt: delivered, deliveredAt: '2026-10-01', referralPotential: false, checks };
  assert.equal(deliveryInput.safeParse(base).success, true);
  assert.equal(deliveryInput.safeParse({ ...base, deliveredAt: null, checks: { ...checks, deliveryReceived: true } }).success, false);
  assert.equal(deliveryInput.safeParse({ ...base, premium: '0.01' }).success, false);
  assert.equal(deliveryInput.safeParse({ ...base, followUps: { SEGUIMIENTO_7: true, OTRO: true } }).success, false);
  assert.equal(deliveryInput.safeParse({ ...base, expectedUpdatedAt: undefined }).success, false);
});
