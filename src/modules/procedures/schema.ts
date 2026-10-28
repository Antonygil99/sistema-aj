import { z } from 'zod';
export const template = { id: 'metlife-cambios-gmm', title: 'Cambios GMM individual MetLife', code: 'IG-2-020 VER. 11', hash: '0030dd03d728710d6b94a114524de8d6c1595864c2ef6130923de367e08f87c9', key: 'system/templates/metlife-cambios-gmm/0030dd03d728710d6b94a114524de8d6c1595864c2ef6130923de367e08f87c9.pdf' } as const;
export const changeLabels = { ADDRESS: 'Cambio de domicilio', RFC: 'Corrección de RFC' } as const;
export const statusLabels = { DRAFT: 'En preparación', REVIEWED: 'Datos revisados', AWAITING_SIGNATURE: 'Pendiente de firma', SUBMITTED: 'Presentado a aseguradora', COMPLETED: 'Endoso recibido', CANCELLED: 'Cancelado' } as const;
export const attachmentLabels = { IDENTITY: 'Identificación del contratante', FORMAT5: 'Formato 5 / actualización de información', ADDRESS_PROOF: 'Comprobante de domicilio', SIGNED_REQUEST: 'Solicitud revisada y firmada', SUBMISSION: 'Acuse de presentación', ENDORSEMENT: 'Endoso o respuesta aceptada' } as const;
export type AttachmentKind = keyof typeof attachmentLabels;
// Only administrative structured values. No medical narrative, signatures or bank/card information.
const text = (max: number) => z.string().trim().max(max).default('');
const rfc = z.string().trim().toUpperCase().regex(/^([A-ZÑ&]{4}\d{6}[A-Z0-9]{3})?$/, 'Revisa el RFC de persona física.').default('');
export const procedureData = z.object({
  change: z.enum(['ADDRESS', 'RFC']), givenNames: text(55), paternalSurname: text(45), maternalSurname: text(45), taxId: rfc,
  phone: z.string().trim().regex(/^(\+?[1-9]\d{7,14})?$/).default(''), email: z.union([z.literal(''), z.email().max(120)]).default(''),
  place: text(65), date: z.union([z.literal(''), z.iso.date()]).default(''), requestedDate: z.union([z.literal(''), z.iso.date()]).default(''),
  street: text(90), exterior: text(15), interior: text(15), colony: text(55), postalCode: z.string().regex(/^(\d{5})?$/).default(''), city: text(55), state: text(45),
  newTaxId: rfc,
  contractorConfirmed: z.boolean().default(false), individualConfirmed: z.boolean().default(false), templateConfirmed: z.boolean().default(false),
}).strict();
export type ProcedureData = z.infer<typeof procedureData>;
export const createProcedure = z.object({policyId:z.string().min(1).max(100),change:z.enum(['ADDRESS','RFC']),requestKey:z.uuid()}).strict();
export const saveProcedure = z.object({expectedRevision:z.number().int().positive(),data:procedureData,followUpDate:z.union([z.literal(''),z.iso.date()]).default('')}).strict();
export const attachProcedure = z.object({expectedRevision:z.number().int().positive(),kind:z.enum(Object.keys(attachmentLabels) as [AttachmentKind,...AttachmentKind[]]),documentId:z.string().min(1).max(100)}).strict();
export const transitionProcedure = z.object({expectedRevision:z.number().int().positive(),status:z.enum(['DRAFT','REVIEWED','AWAITING_SIGNATURE','SUBMITTED','COMPLETED','CANCELLED']),confirmed:z.literal(true),reference:text(100),date:z.union([z.literal(''),z.iso.date()]).default('')}).strict();
export function reviewIssues(data: ProcedureData) {
  const missing:string[]=[];
  if(!data.givenNames||!data.paternalSurname)missing.push('Nombre(s) y apellido paterno del contratante');
  if(!data.taxId)missing.push('RFC actual del contratante');
  if(!data.phone&&!data.email)missing.push('Teléfono o correo del contratante');
  if(!data.place||!data.date||!data.requestedDate)missing.push('Lugar, fecha de elaboración y fecha solicitada');
  if(!data.contractorConfirmed)missing.push('Confirmar quién es el contratante (no se deduce del cliente)');
  if(!data.individualConfirmed)missing.push('Confirmar GMM individual');
  if(!data.templateConfirmed)missing.push('Confirmar plantilla y canal aplicables con la aseguradora');
  if(data.change==='ADDRESS'&&(!data.street||!data.exterior||!data.colony||!data.postalCode||!data.city||!data.state))missing.push('Domicilio nuevo completo');
  if(data.change==='RFC'&&(!data.newTaxId||data.newTaxId===data.taxId))missing.push('RFC nuevo distinto del actual');
  return missing;
}
export function requiredAttachments(change: ProcedureData['change']): AttachmentKind[] { return ['IDENTITY','FORMAT5',...(change==='ADDRESS'?['ADDRESS_PROOF' as const]:[])]; }
export function changeDetail(data: ProcedureData) {
  return data.change==='RFC'?`Corrección de RFC. Dato nuevo: ${data.newTaxId}.`:`Cambio de domicilio. Dato nuevo: ${data.street} ${data.exterior}${data.interior?' interior '+data.interior:''}, ${data.colony}, C.P. ${data.postalCode}, ${data.city}, ${data.state}.`;
}
