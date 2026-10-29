import {z} from 'zod';
export const preparationSchema=z.object({
  expectedUpdatedAt:z.iso.datetime().nullable(),expectedPolicyUpdatedAt:z.iso.datetime(),
  status:z.enum(['PREPARING','READY','COMMUNICATED']),number:z.string().trim().max(250),
  premium:z.string().regex(/^(\d{1,9}(\.\d{1,2})?)?$/),currency:z.enum(['MXN','USD','UDI']),
  startDate:z.union([z.literal(''),z.iso.date()]),endDate:z.union([z.literal(''),z.iso.date()]),
  deductible:z.string().trim().max(1000).default(''),coinsurance:z.string().trim().max(1000).default(''),insuredAmount:z.string().trim().max(1000).default(''),coverageChanges:z.string().trim().max(2500).default(''),
  paymentNotes:z.string().trim().max(2500),summary:z.string().trim().max(5000),
  oldDocumentId:z.string().max(100),newDocumentId:z.string().max(100),
  channel:z.enum(['','EMAIL','WHATSAPP','PHONE','OTHER']),communicationNote:z.string().trim().max(500),reviewed:z.boolean(),
}).strict().superRefine((d,ctx)=>{
  if(d.status!=='PREPARING'&&(!d.reviewed||!d.number||!d.premium||Number(d.premium)<=0||!d.startDate||!d.endDate||d.endDate<=d.startDate||!d.oldDocumentId||!d.newDocumentId||d.oldDocumentId===d.newDocumentId))ctx.addIssue({code:'custom',message:'Revisa el número, importes, vigencias y los dos documentos antes de marcar lista.'});
  if(d.status==='COMMUNICATED'&&(!d.channel||!d.communicationNote))ctx.addIssue({code:'custom',message:'Registra el medio y referencia de la comunicación efectivamente realizada.'});
});
export function premiumComparison(previous:string,next:string,previousCurrency:string,nextCurrency:string){
  if(previousCurrency!==nextCurrency)return {difference:null,percent:null,reason:'Las monedas son distintas; no se calcula variación.'};
  if(previousCurrency==='UDI')return {difference:null,percent:null,reason:'Revisión especializada de UDI pendiente; no convertir a MXN.'};
  const cents=(s:string)=>/^\d+(\.\d{1,2})?$/.test(s)?Math.round(Number(s)*100):NaN;
  const a=cents(previous),b=cents(next);
  if(!Number.isSafeInteger(a)||!Number.isSafeInteger(b)||a<=0||b<=0)return {difference:null,percent:null,reason:'Faltan primas totales comparables mayores que cero.'};
  return {difference:((b-a)/100).toFixed(2),percent:((b-a)*100/a).toFixed(2),reason:null};
}
