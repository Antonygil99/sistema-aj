import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyProspectRules, diagnosisProgress, isDiagnosed, nextStage, stageMessage } from '../src/modules/prospectos/pipeline';
import { createSchema } from '../src/modules/prospectos/schema';
const answers = { diagProtect: 'A mis hijos', diagDependents: 'Dos hijos', diagCare: 'Hospital Faro del Mayab', diagCoverage: 'IMSS', diagPain: 'DECIDIR' };

test('el diagnóstico cuenta las 5 preguntas y la de cobertura acepta IMSS/póliza o la nota de antecedentes', () => {
  assert.equal(diagnosisProgress({}), 0);
  assert.equal(diagnosisProgress({ diagProtect: '  ', diagDependents: 'Dos hijos' }), 1, 'texto vacío no cuenta');
  assert.equal(diagnosisProgress({ ...answers, diagCoverage: undefined, diagMedicalHistory: 'NO_SABE' }), 5);
  assert.equal(isDiagnosed(answers), true);
  assert.equal(isDiagnosed({ ...answers, diagPain: undefined }), false);
});

test('un prospecto curioso con las 5 respuestas pasa solo a diagnosticado y nunca retrocede', () => {
  assert.equal(applyProspectRules({ status: 'CURIOSO', ...answers }).status, 'DIAGNOSTICADO');
  assert.equal(applyProspectRules({ status: 'CURIOSO', diagProtect: 'x' }).status, 'CURIOSO');
  assert.equal(applyProspectRules({ status: 'COMPARATIVO', ...answers }).status, 'COMPARATIVO');
  assert.equal(applyProspectRules({ status: 'PERDIDO', ...answers }).status, 'PERDIDO');
});

test('las etapas avanzan en el orden de la Ruta AJ y se detienen en emisión', () => {
  assert.equal(nextStage('CURIOSO'), 'DIAGNOSTICADO');
  assert.equal(nextStage('COMPARATIVO'), 'EMISION');
  assert.equal(nextStage('EMISION'), null, 'emitir se hace convirtiendo en cliente');
  assert.equal(nextStage('PERDIDO'), null);
  assert.match(stageMessage('COMPARATIVO') ?? '', /uso real/);
});

test('el prospecto guarda antecedentes solo como existencia y no acepta marcarse cliente sin conversión', () => {
  assert.equal(createSchema.safeParse({ name: 'Ana', diagMedicalHistory: 'SI' }).success, true);
  assert.equal(createSchema.safeParse({ name: 'Ana', diagMedicalHistory: 'Diabetes tipo 2' }).success, false, 'nunca el detalle');
  assert.equal(createSchema.safeParse({ name: 'Ana', status: 'CLIENTE' }).success, false);
  assert.equal(createSchema.safeParse({ name: 'Ana', convertedClientId: 'c1' }).success, false);
  assert.equal(createSchema.parse({ name: 'Ana' }).status, 'CURIOSO');
});
