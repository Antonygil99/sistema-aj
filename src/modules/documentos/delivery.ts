import {z} from 'zod';
export const deliveryKinds={INTERNAL:'Interno / sin clasificar',POLICY_COVER:'Carátula de póliza',PAYMENT_RECEIPT:'Recibo de aseguradora'} as const;
export const deliveryInput=z.object({expectedUpdatedAt:z.iso.datetime(),deliveryKind:z.enum(['INTERNAL','POLICY_COVER','PAYMENT_RECEIPT']),reviewed:z.boolean()}).strict().refine(d=>d.deliveryKind==='INTERNAL'||d.reviewed,{message:'Revisa el contenido y confirma que no contiene documentación interna.'});
// This predicate is used by both the picker and the send route; filenames never confer permission.
export function deliverableWhere(clientId:string){return {archivedAt:null,deliveryReviewed:true,deliveryKind:{in:['POLICY_COVER','PAYMENT_RECEIPT']},mimeType:{in:['application/pdf','image/jpeg','image/png','image/webp']},policy:{clientId,archivedAt:null,client:{archivedAt:null}},claimId:null};}
