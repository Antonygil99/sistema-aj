import 'server-only';
import {z} from 'zod';import {getDb} from '@/lib/db';import type {Actor} from '@/lib/api';import {EmailError} from '@/integrations/resend/client';import {templateKinds,templateInfo,type TemplateKind} from './template-text';import {eventData} from '@/modules/events';
export const brokerTemplateInput=z.object({id:z.string().max(100).optional(),expectedUpdatedAt:z.iso.datetime().optional(),name:z.string().trim().min(2).max(80),kind:z.enum(templateKinds),subject:z.string().trim().min(1).max(200),body:z.string().trim().min(1).max(10000),isDefault:z.boolean()}).strict().superRefine((v,c)=>{for(const field of ['subject','body'] as const)for(const match of v[field].matchAll(/\{([^{}]+)\}/g))if(!(templateInfo[v.kind].placeholders as readonly string[]).includes(match[1]))c.addIssue({code:'custom',path:[field],message:'Variable no disponible para este tipo: '+match[1]});});
export function templateOwner(a:Actor){if(!a.id||!a.email||a.role==='USER')throw new EmailError('FORBIDDEN',403);return a.email.toLowerCase();}
export async function brokerTemplates(a:Actor){return getDb().brokerEmailTemplate.findMany({where:{ownerEmail:templateOwner(a)},orderBy:[{name:'asc'},{id:'asc'}],take:100});}
export async function personalTemplate(a:Actor,kind:TemplateKind,id?:string|null){const ownerEmail=templateOwner(a);const row=await getDb().brokerEmailTemplate.findFirst({where:{ownerEmail,kind,...(id?{id}:{defaultKind:kind})}});if(id&&!row)throw new EmailError('TEMPLATE_NOT_FOUND',404);return row;}
export async function saveBrokerTemplate(a:Actor,input:unknown){const ownerEmail=templateOwner(a),d=brokerTemplateInput.parse(input),db=getDb();return db.$transaction(async tx=>{
 await tx.$queryRaw`SELECT id FROM "AuthUser" WHERE id=${a.id!} FOR UPDATE`;
 if(d.id){const old=await tx.brokerEmailTemplate.findFirst({where:{id:d.id,ownerEmail}});if(!old)throw new EmailError('TEMPLATE_NOT_FOUND',404);if(!d.expectedUpdatedAt||old.updatedAt.toISOString()!==d.expectedUpdatedAt)throw new EmailError('RECORD_CHANGED',409);}
 else if(await tx.brokerEmailTemplate.count({where:{ownerEmail}})>=100)throw new EmailError('TEMPLATE_LIMIT',422);
 if(d.isDefault)await tx.brokerEmailTemplate.updateMany({where:{ownerEmail,defaultKind:d.kind,...(d.id?{id:{not:d.id}}:{})},data:{defaultKind:null}});
 const data={name:d.name,kind:d.kind,subject:d.subject,body:d.body,defaultKind:d.isDefault?d.kind:null};
 const saved=d.id?await tx.brokerEmailTemplate.update({where:{id:d.id},data}):await tx.brokerEmailTemplate.create({data:{...data,ownerEmail}});
 await tx.crmEvent.create({data:eventData(a,'updated','plantillas',saved.id,'Plantilla personal guardada')});return saved;
 });}
export async function deleteBrokerTemplate(a:Actor,id:string,expectedUpdatedAt:string){const ownerEmail=templateOwner(a),db=getDb();await db.$transaction(async tx=>{const r=await tx.brokerEmailTemplate.deleteMany({where:{id,ownerEmail,updatedAt:new Date(expectedUpdatedAt)}});if(!r.count)throw new EmailError('RECORD_CHANGED',409);await tx.crmEvent.create({data:eventData(a,'deleted','plantillas',id,'Plantilla personal eliminada')});});}
