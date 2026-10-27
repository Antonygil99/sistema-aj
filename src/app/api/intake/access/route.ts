import { cookies } from 'next/headers';
import { z } from 'zod';
import { unlockIntake } from '@/modules/intake/server';
import { intakeBody, intakeError, intakeJson, publicOrigin } from '@/modules/intake/http';
import { intakeCookie } from '@/modules/intake/tokens';
export const runtime='nodejs';
export async function POST(request:Request){try{publicOrigin(request);const input=z.object({token:z.string().length(43),pin:z.string().regex(/^\d{8}$/)}).strict().parse(await intakeBody(request));const secret=await unlockIntake(input.token,input.pin);const response=intakeJson({unlocked:true});response.cookies.set(intakeCookie,secret,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/api/intake',maxAge:3600});return response;}catch(e){return intakeError(e);}}
export async function DELETE(request:Request){try{publicOrigin(request);const jar=await cookies();jar.set(intakeCookie,'',{path:'/api/intake',maxAge:0,httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict'});return intakeJson({saved:true});}catch(e){return intakeError(e);}}
