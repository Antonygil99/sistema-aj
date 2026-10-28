import { z } from 'zod';
import { authenticate } from '@/lib/api';
import { scheduleProcedureFollowUp } from '@/modules/procedures/server';
import { intakeBody, intakeError, intakeJson } from '@/modules/intake/http';
export const runtime='nodejs';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){const auth=await authenticate(request,'ADMIN');if(auth.denied)return auth.denied;try{const input=z.object({expectedRevision:z.number().int().positive(),date:z.union([z.literal(''),z.iso.date()])}).strict().parse(await intakeBody(request));return intakeJson(await scheduleProcedureFollowUp((await params).id,input.expectedRevision,input.date,auth.actor));}catch(e){return intakeError(e);}}
