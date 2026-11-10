// Ruta de implementación AJ, etapas 1–4 (prospecto curioso → emisión). Pure and unit tested.
export const prospectStages = [
  { id: 'CURIOSO', label: 'Curioso', hint: 'Entiende el problema y pide información', message: 'No se trata de comprar una póliza; se trata de conservar tu capacidad de decidir cuando la vida se sale del plan.' },
  { id: 'INFORMACION_RECIBIDA', label: 'Información recibida', hint:'Datos iniciales recibidos', message:'Revisa los datos recibidos y confirma lo que falta antes de preparar la propuesta.' },
  { id: 'DIAGNOSTICADO', label: 'Diagnosticado', hint: 'Necesidades y datos revisados', message: 'Entendamos tu caso particular antes de hablar de productos.' },
  { id: 'PROPUESTA_ENVIADA', label: 'Propuesta enviada', hint:'Propuesta compartida con el prospecto', message:'Confirma que recibió la propuesta y acompaña sus dudas.' },
  { id: 'DOCUMENTACION', label: 'Documentación', hint:'Reunir y revisar documentos', message:'Revisa la documentación necesaria antes de solicitar la emisión.' },
  { id: 'EMISION', label: 'Emisión', hint: 'Datos completos para emitir', message: 'Mientras más clara salga la información desde el inicio, mejor se protege tu póliza.' },
] as const;
export const closedStages = { CLIENTE: 'Cliente', PERDIDO: 'Pérdida' } as const;
export type ProspectStage = typeof prospectStages[number]['id'] | keyof typeof closedStages | 'COMPARATIVO';
export const stageLabels: Record<ProspectStage, string> = { ...Object.fromEntries(prospectStages.map(stage => [stage.id, stage.label])),COMPARATIVO:'Comparativo guiado (anterior)', ...closedStages } as Record<ProspectStage, string>;
export const activeProspectStatuses=[...prospectStages.map(stage=>stage.id),'COMPARATIVO'] as const;
export const autoProfileFields=['sex','age','postalCode','vehicle','paymentFrequency','paymentMethod'] as const;
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
  if(row.line==='AUTO')return autoProfileFields.filter(field=>filled(row[field])).length;
  return diagnosisQuestions.filter(question => question.fields.some(field => filled(row[field]))).length;
}
export const isDiagnosed = (row: Record<string, unknown>) => diagnosisProgress(row) === (row.line==='AUTO'?autoProfileFields.length:diagnosisQuestions.length);
// A curious prospect who answered everything moves to "Diagnosticado"; later stages are never demoted.
export function applyProspectRules<T extends Record<string, unknown>>(data: T): T {
  if(data.line&&data.line!=='MEDICAL')return {...data,...Object.fromEntries(['diagProtect','diagDependents','diagCare','diagCoverage','diagMedicalHistory','diagPain'].filter(key=>key in data).map(key=>[key,null]))};
  return ['CURIOSO','INFORMACION_RECIBIDA'].includes(String(data.status)) && isDiagnosed(data) ? { ...data, status: 'DIAGNOSTICADO' } : data;
}
export function nextStage(status: string): ProspectStage | null {
  if(status==='COMPARATIVO')return 'DOCUMENTACION';
  const index = prospectStages.findIndex(stage => stage.id === status);
  return index >= 0 && index < prospectStages.length - 1 ? prospectStages[index + 1].id : null;
}
export const stageMessage = (status: string) => status==='COMPARATIVO'?'Revisa el uso real y las diferencias de las propuestas.':prospectStages.find(stage => stage.id === status)?.message ?? null;
