import {z} from 'zod';
export const preparationStages={PREPARING:'Por preparar',REQUESTED:'Solicitada a la aseguradora',RECEIVED:'Propuesta recibida',READY:'Revisada y lista para comunicar',COMMUNICATED:'Comunicación realizada',FOLLOW_UP:'En seguimiento',NOT_RENEWED:'No renovada',RENEWED:'Nueva vigencia registrada'} as const;
export type PreparationStage=keyof typeof preparationStages;
export function canTransitionPreparation(from:string,to:PreparationStage){
 if(from==='RENEWED'||to==='RENEWED')return false;
 if(from===to)return true;
 const next:Record<string,PreparationStage[]>={PREPARING:['REQUESTED','RECEIVED','READY','NOT_RENEWED'],REQUESTED:['PREPARING','RECEIVED','NOT_RENEWED'],RECEIVED:['PREPARING','REQUESTED','READY','NOT_RENEWED'],READY:['PREPARING','COMMUNICATED','NOT_RENEWED'],COMMUNICATED:['PREPARING','FOLLOW_UP','NOT_RENEWED'],FOLLOW_UP:['PREPARING','COMMUNICATED','NOT_RENEWED'],NOT_RENEWED:['PREPARING']};
 return next[from]?.includes(to)??false;
}
export const preparationSchema=z.object({
  expectedUpdatedAt:z.iso.datetime().nullable(),expectedPolicyUpdatedAt:z.iso.datetime(),
  status:z.enum(Object.keys(preparationStages) as [PreparationStage,...PreparationStage[]]),number:z.string().trim().max(250),
  premium:z.string().regex(/^(\d{1,9}(\.\d{1,2})?)?$/),currency:z.enum(['MXN','USD','UDI']),
  startDate:z.union([z.literal(''),z.iso.date()]),endDate:z.union([z.literal(''),z.iso.date()]),
  deductible:z.string().trim().max(1000).default(''),coinsurance:z.string().trim().max(1000).default(''),insuredAmount:z.string().trim().max(1000).default(''),coverageChanges:z.string().trim().max(2500).default(''),
  requestReference:z.string().trim().max(500).default(''),followUpDate:z.union([z.literal(''),z.iso.date()]).default(''),outcomeNote:z.string().trim().max(1000).default(''),
  paymentNotes:z.string().trim().max(2500),summary:z.string().trim().max(5000),
  oldDocumentId:z.string().max(100),newDocumentId:z.string().max(100),
  channel:z.enum(['','EMAIL','WHATSAPP','PHONE','OTHER']),communicationNote:z.string().trim().max(500),reviewed:z.boolean(),
}).strict().superRefine((d,ctx)=>{
  if(d.status==='REQUESTED'&&(!d.requestReference||!d.followUpDate))ctx.addIssue({code:'custom',message:'Registra la referencia de solicitud y la próxima fecha de seguimiento.'});
  if(d.status==='RECEIVED'&&!d.newDocumentId)ctx.addIssue({code:'custom',message:'Vincula la propuesta recibida.'});
  if(d.status==='FOLLOW_UP'&&!d.followUpDate)ctx.addIssue({code:'custom',message:'Programa el siguiente seguimiento.'});
  if(d.status==='NOT_RENEWED'&&!d.outcomeNote)ctx.addIssue({code:'custom',message:'Registra el motivo de no renovación; esto no cancela la póliza.'});
  if(['READY','COMMUNICATED','FOLLOW_UP'].includes(d.status)&&(!d.reviewed||!d.number||!d.premium||Number(d.premium)<=0||!d.startDate||!d.endDate||d.endDate<=d.startDate||!d.oldDocumentId||!d.newDocumentId||d.oldDocumentId===d.newDocumentId))ctx.addIssue({code:'custom',message:'Revisa el número, importes, vigencias y los dos documentos antes de marcar lista.'});
  if(['COMMUNICATED','FOLLOW_UP'].includes(d.status)&&(!d.channel||!d.communicationNote))ctx.addIssue({code:'custom',message:'Registra el medio y referencia de la comunicación efectivamente realizada.'});
});
export function premiumComparison(previous:string,next:string,previousCurrency:string,nextCurrency:string){
  if(previousCurrency!==nextCurrency)return {difference:null,percent:null,reason:'Las monedas son distintas; no se calcula variación.'};
  if(previousCurrency==='UDI')return {difference:null,percent:null,reason:'Revisión especializada de UDI pendiente; no convertir a MXN.'};
  const cents=(s:string)=>/^\d+(\.\d{1,2})?$/.test(s)?Math.round(Number(s)*100):NaN;
  const a=cents(previous),b=cents(next);
  if(!Number.isSafeInteger(a)||!Number.isSafeInteger(b)||a<=0||b<=0)return {difference:null,percent:null,reason:'Faltan primas totales comparables mayores que cero.'};
  return {difference:((b-a)/100).toFixed(2),percent:((b-a)*100/a).toFixed(2),reason:null};
}
