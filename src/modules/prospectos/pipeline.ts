// Ruta de implementación AJ, etapas 1–4 (prospecto curioso → emisión). Pure and unit tested.
export const prospectStages = [
  { id: 'CURIOSO', label: 'Curioso', hint: 'Entiende el problema y pide información', message: 'No se trata de comprar una póliza; se trata de conservar tu capacidad de decidir cuando la vida se sale del plan.' },
  { id: 'INFORMACION_RECIBIDA', label: 'Información recibida', hint:'Datos iniciales recibidos', message:'Revisa los datos recibidos y confirma lo que falta antes de preparar la propuesta.' },
  { id: 'DIAGNOSTICADO', label: 'Diagnóstico', hint: 'Necesidades y datos revisados', message: 'Entendamos tu caso particular antes de hablar de productos.' },
  { id: 'PROPUESTA_ENVIADA', label: 'Propuesta enviada', hint:'Propuesta compartida con el prospecto', message:'Confirma que recibió la propuesta y acompaña sus dudas.' },
  { id: 'DOCUMENTACION', label: 'Documentación recibida', hint:'Reunir y revisar documentos', message:'Revisa la documentación necesaria antes de solicitar la emisión.' },
  { id: 'EMISION_SOLICITADA', label: 'Emisión solicitada', hint: 'Solicitud enviada a la aseguradora', message: 'Solicitud enviada a la aseguradora.' },
  { id: 'INFORMACION_ADICIONAL', label: 'Información adicional', hint: 'Completar la información solicitada', message: 'Completar la información solicitada.' },
  { id: 'REENVIO_EMISION', label: 'Reenvío emisión', hint: 'Solicitud complementada y reenviada', message: 'Solicitud complementada y reenviada.' },
  { id: 'FIRMA', label: 'Firma', hint: 'Dar seguimiento a la firma requerida', message: 'Dar seguimiento a la firma requerida.' },
  { id: 'EMITIDA', label: 'Emitida', hint: 'Póliza emitida; vincula su expediente', message: 'Mientras más clara salga la información desde el inicio, mejor se protege tu póliza.' },
] as const;
export const closedStages = { CLIENTE: 'Cliente', PERDIDO: 'Pérdida' } as const;
export type ProspectStage = typeof prospectStages[number]['id'] | keyof typeof closedStages | 'COMPARATIVO' | 'EMISION';
export const stageLabels: Record<ProspectStage, string> = { ...Object.fromEntries(prospectStages.map(stage => [stage.id, stage.label])),EMISION:'Emisión (anterior)',COMPARATIVO:'Comparativo guiado (anterior)', ...closedStages } as Record<ProspectStage, string>;
export const activeProspectStatuses=[...prospectStages.map(stage=>stage.id),'COMPARATIVO','EMISION'] as const;
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
// Quick actions explicitly represent branches; final conversion remains a separate operation.
export function nextStages(status: string): ProspectStage[] {
  if(status==='COMPARATIVO')return ['DOCUMENTACION'];
  if(status==='DOCUMENTACION')return ['EMISION_SOLICITADA','EMITIDA'];
  if(status==='EMISION_SOLICITADA')return ['INFORMACION_ADICIONAL','FIRMA'];
  if(status==='REENVIO_EMISION')return ['INFORMACION_ADICIONAL','FIRMA'];
  const index=prospectStages.findIndex(stage=>stage.id===status);
  return index>=0&&index<prospectStages.length-1?[prospectStages[index+1].id]:[];
}
export function nextStage(status:string):ProspectStage|null{return nextStages(status)[0]??null;}
export const stageMessage = (status: string) => status==='COMPARATIVO'?'Revisa el uso real y las diferencias de las propuestas.':prospectStages.find(stage => stage.id === status)?.message ?? null;
