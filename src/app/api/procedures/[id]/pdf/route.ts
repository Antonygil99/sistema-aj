import { z } from 'zod';
import { NextResponse } from 'next/server';
import { authenticate } from '@/lib/api';
import { downloadProcedure, exportProcedure } from '@/modules/procedures/server';
import { intakeBody, intakeError, intakeJson, privateHeaders } from '@/modules/intake/http';
export const runtime='nodejs';
export const maxDuration=60;
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){const auth=await authenticate(request,'ADMIN');if(auth.denied)return auth.denied;try{const input=z.object({expectedRevision:z.number().int().positive()}).strict().parse(await intakeBody(request));return intakeJson(await exportProcedure((await params).id,input.expectedRevision,auth.actor));}catch(e){return intakeError(e);}}
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){const auth=await authenticate(request,'ADMIN');if(auth.denied)return auth.denied;try{const url=await downloadProcedure((await params).id,new URL(request.url).searchParams.get('exportId')??'',auth.actor);return new NextResponse(null,{status:302,headers:{...privateHeaders,Location:url}});}catch(e){return intakeError(e);}}
