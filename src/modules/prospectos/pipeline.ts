// Ruta de implementación AJ, etapas 1–4 (prospecto curioso → emisión). Pure and unit tested.
export const prospectStages = [
  { id: 'CURIOSO', label: 'Curioso', hint: 'Entiende el problema y pide información', message: 'No se trata de comprar una póliza; se trata de conservar tu capacidad de decidir cuando la vida se sale del plan.' },
  { id: 'DIAGNOSTICADO', label: 'Diagnosticado', hint: 'Respondió las 5 preguntas', message: 'Entendamos tu caso particular antes de hablar de productos.' },
  { id: 'COMPARATIVO', label: 'Comparativo guiado', hint: 'Compara por uso real', message: 'Vamos a comparar por uso real, no solo por costo.' },
  { id: 'EMISION', label: 'Emisión', hint: 'Datos completos para emitir', message: 'Mientras más clara salga la información desde el inicio, mejor se protege tu póliza.' },
] as const;
export const closedStages = { CLIENTE: 'Cliente', PERDIDO: 'Perdido' } as const;
export type ProspectStage = typeof prospectStages[number]['id'] | keyof typeof closedStages;
export const stageLabels: Record<ProspectStage, string> = { ...Object.fromEntries(prospectStages.map(stage => [stage.id, stage.label])), ...closedStages } as Record<ProspectStage, string>;
// "Diagnosticado" means the five diagnostic questions are answered (client decision).
export const diagnosisQuestions = [
  { id: 'proteger', fields: ['diagProtect'], question: '¿Qué te preocupa proteger?' },
  { id: 'dependientes', fields: ['diagDependents'], question: '¿Quién depende de ti?' },
  { id: 'atencion', fields: ['diagCare'], question: '¿Qué hospital o médico usarías si algo pasa?' },
  { id: 'cobertura', fields: ['diagCoverage', 'diagMedicalHistory'], question: '¿Tienes IMSS, póliza actual o antecedentes médicos?' },
  { id: 'dolor', fields: ['diagPain'], question: '¿Qué te dolería más: pagar una prima o no poder decidir dónde atenderte?' },
] as const;
const filled = (value: unknown) => typeof value === 'string' ? value.trim().length > 0 : value !== null && value !== undefined;
export function diagnosisProgress(row: Record<string, unknown>) {
  return diagnosisQuestions.filter(question => question.fields.some(field => filled(row[field]))).length;
}
export const isDiagnosed = (row: Record<string, unknown>) => diagnosisProgress(row) === diagnosisQuestions.length;
// A curious prospect who answered everything moves to "Diagnosticado"; later stages are never demoted.
export function applyProspectRules<T extends Record<string, unknown>>(data: T): T {
  return data.status === 'CURIOSO' && isDiagnosed(data) ? { ...data, status: 'DIAGNOSTICADO' } : data;
}
export function nextStage(status: string): ProspectStage | null {
  const index = prospectStages.findIndex(stage => stage.id === status);
  return index >= 0 && index < prospectStages.length - 1 ? prospectStages[index + 1].id : null;
}
export const stageMessage = (status: string) => prospectStages.find(stage => stage.id === status)?.message ?? null;
