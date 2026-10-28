import { z } from 'zod';
import { createSchema as prospectSchema } from '@/modules/prospectos/schema';
import { createSchema as clientSchema } from '@/modules/clientes/schema';
export const MAX_IMPORT_ROWS=500;
export const targetSchema=z.enum(['prospectos','clientes']);
export type ImportTarget=z.infer<typeof targetSchema>;
export const importFields=['name','email','phone','taxId','source'] as const;
export type ImportField=typeof importFields[number];
export const fieldNames:Record<ImportField,string>={name:'Nombre completo',email:'Correo',phone:'Teléfono',taxId:'RFC',source:'Origen'};
const cell=z.string().max(500).optional();
export const contactRowSchema=z.object({name:cell,email:cell,phone:cell,taxId:cell,source:cell,sourceRef:z.string().max(100).optional(),uncertainFields:z.array(z.enum(importFields)).max(5).optional()}).strict();
export type ContactInput=z.infer<typeof contactRowSchema>;
export const prepareImportSchema=z.object({target:targetSchema,sourceName:z.string().trim().min(1).max(180),sourceKind:z.enum(['TABLE','EXCEL','CSV','IMAGE','PDF']).default('TABLE'),countryCode:z.enum(['52']).optional(),rows:z.array(contactRowSchema).min(1).max(MAX_IMPORT_ROWS)}).strict();
export type PrepareImport=z.infer<typeof prepareImportSchema>;
export class ImportError extends Error{constructor(public code:string,public status=400){super(code);}}
export const normalizeName=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLocaleUpperCase('es-MX');
export function phoneKey(value:string){const digits=value.replace(/\D/g,'');return /^521\d{10}$/.test(digits)?'52'+digits.slice(3):digits;}
export type ContactData={name:string;email?:string;phone?:string;taxId?:string;source?:string};
export function normalizeContact(input:ContactInput,target:ImportTarget,countryCode?:string){
  const data:ContactData={name:(input.name??'').normalize('NFC').trim().replace(/\s+/g,' ')},issues:string[]=[],warnings:string[]=[];
  const email=input.email?.trim().toLowerCase(),taxId=input.taxId?.trim().toUpperCase().replace(/\s/g,'');
  if(email)data.email=email;
  if(taxId&&target==='clientes'){data.taxId=taxId;if(!/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(taxId))issues.push('RFC: revisa sus 12 o 13 caracteres.');}
  const rawPhone=input.phone?.trim();
  if(rawPhone){
    let digits=rawPhone.replace(/[\s().-]/g,'').replace(/^00/,'+');
    if(/^\d{10}$/.test(digits)){if(countryCode)digits='+'+countryCode+digits;else issues.push('Teléfono: indica la lada de país; para México puedes elegir +52.');}
    if(!/^\+?\d+$/.test(digits))issues.push('Teléfono: no incluyas letras ni extensiones en el número.');
    const canonical=phoneKey(digits);data.phone=digits.startsWith('+')?'+'+canonical:digits;
    if(!/^\+\d{8,15}$/.test(data.phone))issues.push('Teléfono: usa formato internacional, por ejemplo +529991112233.');
  }
  if(target==='prospectos')data.source=input.source?.trim()||'Importación';
  const parsed=(target==='clientes'?clientSchema:prospectSchema).safeParse(data);
  if(!parsed.success)for(const issue of parsed.error.issues){const key=String(issue.path[0]??'name') as ImportField;issues.push(`${fieldNames[key]??'Dato'}: revisa el valor${key==='name'?' (obligatorio, máximo 250 caracteres)':''}.`);}
  if(!data.email&&!data.phone)warnings.push('Sin correo ni teléfono; quedará pendiente completar el contacto.');
  if(input.uncertainFields?.length)warnings.push('Revisar contra el original: '+input.uncertainFields.map(k=>fieldNames[k]).join(', ')+'.');
  return {data,issues:[...new Set(issues)],warnings};
}
export type MatchContact={id:string;module:ImportTarget;name:string;email:string|null;phone:string|null;taxId?:string|null;archivedAt:Date|string|null};
export type Match={id:string;module:ImportTarget|'batch';name:string;by:string[];archived:boolean;sourceRow?:number};
export type Candidate={id:string;rowNumber:number;data:ContactData;issues:string[];warnings:string[];allowNameMatch:boolean;sourceRef:string|null;resultId:string|null;status:string;reviewSnapshot?:unknown};
export type PreviewRow=Candidate&{matches:Match[];state:'NEW'|'MATCH'|'ERROR'|'IMPORTED'|'SKIPPED'};
function keys(value:{name:string;email?:string|null;phone?:string|null;taxId?:string|null}){return {name:normalizeName(value.name),email:value.email?.trim().toLowerCase()||'',phone:value.phone?phoneKey(value.phone):'',taxId:value.taxId?.trim().toUpperCase()||''};}
export function matchRows(rows:Candidate[],existing:MatchContact[]):PreviewRow[]{
  const index=new Map<string,MatchContact[]>();
  for(const item of existing)for(const [key,value]of Object.entries(keys(item)))if(value){const k=key+':'+value;index.set(k,[...(index.get(k)??[]),item]);}
  const seen=new Map<string,Candidate[]>();
  for(const row of rows)for(const[key,value]of Object.entries(keys(row.data)))if(value){const k=key+':'+value;seen.set(k,[...(seen.get(k)??[]),row]);}
  return rows.map(row=>{
    if(row.status==='IMPORTED'||row.status==='SKIPPED'){
      const snapshot=row.reviewSnapshot as {matches?:Match[];state?:string}|null;
      return {...row,matches:snapshot?.matches??[],warnings:row.status==='SKIPPED'?[...row.warnings,snapshot?.state==='MATCH'?'Omitida por coincidencia detectada.':snapshot?.state==='ERROR'?'Omitida: había datos por corregir.':'No seleccionada para importar.']:row.warnings,state:row.status};
    }
    const matches=new Map<string,Match>();let strong=false;
    for(const[key,value]of Object.entries(keys(row.data))){
      if(!value)continue;
      for(const item of index.get(key+':'+value)??[]){const id=item.module+':'+item.id;const found=matches.get(id)??{id:item.id,module:item.module,name:item.name,by:[],archived:!!item.archivedAt};found.by.push(key);matches.set(id,found);if(key!=='name')strong=true;}
      for(const other of seen.get(key+':'+value)??[]){if(other.id===row.id||other.status==='SKIPPED')continue;const id='batch:'+other.id;const found=matches.get(id)??{id:other.id,module:'batch' as const,name:other.data.name,by:[],archived:false,sourceRow:other.rowNumber};found.by.push(key);matches.set(id,found);if(key!=='name')strong=true;}
    }
    const found=[...matches.values()];
    return {...row,matches:found,state:row.issues.length?'ERROR':found.length&&(strong||!row.allowNameMatch)?'MATCH':'NEW'};
  });
}
export function reportCounts(rows:PreviewRow[]){return {total:rows.length,new:rows.filter(r=>r.state==='NEW').length,matches:rows.filter(r=>r.state==='MATCH').length,errors:rows.filter(r=>r.state==='ERROR').length,imported:rows.filter(r=>r.state==='IMPORTED').length,skipped:rows.filter(r=>r.state==='SKIPPED').length};}
export function csvCell(value:unknown){let text=String(value??'');if(/^[\s]*[=+\-@]/.test(text)||/^[\t\r\n]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';}
