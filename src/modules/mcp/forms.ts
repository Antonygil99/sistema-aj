import 'server-only';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import type { PrismaClient } from '@/generated/prisma/client';
import { assertIntakeAccess, intakeState, rotateIntakeLink, prepareIntakeDraft } from '@/modules/intake/server';
import { agentProfileSchema } from '@/modules/intake/schema';
import { checkPermission, McpError, jsonData } from './policy';
import type { McpActor } from './actor';
export const intakeProposalInput=z.object({clientId:z.string().min(1).max(100),mode:z.enum(['share','draft']),draft:agentProfileSchema.omit({cliente_id:true,expectedRevision:true}).optional()}).strict().refine(v=>v.mode!=='draft'||!!v.draft,'Indica el nombre y los datos básicos del borrador.');
export type IntakeShare={url:string;pin:string;expiresAt:string};
export async function prepareIntakeProposal(actor:McpActor,input:unknown){
  checkPermission(actor.role,actor.scopes,'update','clientes');
  const data=intakeProposalInput.parse(input),db=getDb(),client=await assertIntakeAccess(data.clientId,actor);
  const intake=await db.clientIntake.findUnique({where:{clientId:data.clientId},select:{updatedAt:true,revision:true,status:true}});
  if(data.mode==='draft'&&intake?.status==='SUBMITTED')throw new McpError('INTAKE_REVIEW_PENDING',409);
  if(await db.mcpChange.count({where:{userId:actor.id,status:'PENDING',expiresAt:{gt:new Date()}}})>=30)throw new McpError('TOO_MANY_PENDING_CHANGES',429);
  const change=await db.mcpChange.create({data:{userId:actor.id,clientId:actor.clientId,module:'clientes',operation:data.mode==='share'?'intake_link':'intake_draft',recordId:data.clientId,expectedUpdatedAt:client.updatedAt,data:jsonData({...(data.mode==='draft'?data.draft:{}),_expectedRevision:intake?.revision??0,_expectedIntakeUpdatedAt:intake?.updatedAt.toISOString()??null}),expiresAt:new Date(Date.now()+900000)}});
  return {id:change.id,module:change.module,operation:change.operation,status:change.status,reviewPath:`/conexiones/revisar/${change.id}`,expiresAt:change.expiresAt.toISOString()};
}
export async function applyIntakeProposal(actor:McpActor,clientId:string,operation:string,data:Record<string,unknown>,db:PrismaClient){
  await assertIntakeAccess(clientId,actor,db);
  const intake=await db.clientIntake.findUnique({where:{clientId}});
  if(intake)await db.$queryRaw`SELECT id FROM "ClientIntake" WHERE id=${intake.id} FOR UPDATE`;
  const current=await db.clientIntake.findUnique({where:{clientId}});
  if((current?.updatedAt.toISOString()??null)!==data._expectedIntakeUpdatedAt||(current?.revision??0)!==data._expectedRevision)throw new McpError('RECORD_CHANGED',409);
  if(operation==='intake_link'){
    const shared=await rotateIntakeLink(clientId,actor,db),url=new URL('/completar',process.env.BETTER_AUTH_URL!);url.hash=shared.token;
    return {id:clientId,share:{url:url.href,pin:shared.pin,expiresAt:shared.expiresAt.toISOString()} satisfies IntakeShare};
  }
  const draft=Object.fromEntries(Object.entries(data).filter(([key])=>!key.startsWith('_')));
  await prepareIntakeDraft({...draft,cliente_id:clientId,expectedRevision:data._expectedRevision},actor,db);
  return {id:clientId,share:undefined};
}
export async function intakeSummary(actor:McpActor,clientId:string){
  checkPermission(actor.role,actor.scopes,'read','clientes');
  const state=await intakeState(clientId,actor),row=await getDb().clientIntake.findUnique({where:{clientId},select:{answers:true,expiresAt:true,tokenHash:true}});
  const answers=row?.answers&&typeof row.answers==='object'&&!Array.isArray(row.answers)?row.answers as Record<string,unknown>:{};
  const missing=['fullName','email','phone','taxId'].filter(key=>!answers[key]);
  return {...state,missing,linkActive:!!row?.tokenHash&&!!row?.expiresAt&&row.expiresAt>new Date()};
}
