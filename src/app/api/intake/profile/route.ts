import { cookies } from 'next/headers';
import { publicIntake, submitIntake } from '@/modules/intake/server';
import { intakeBody, intakeError, intakeJson, publicOrigin } from '@/modules/intake/http';
import { intakeCookie } from '@/modules/intake/tokens';
export const runtime='nodejs';
export async function GET(){try{return intakeJson(await publicIntake((await cookies()).get(intakeCookie)?.value??''));}catch(e){return intakeError(e);}}
export async function POST(request:Request){try{publicOrigin(request);const result=await submitIntake(null,await intakeBody(request),null,(await cookies()).get(intakeCookie)?.value??'');const response=intakeJson(result);response.cookies.set(intakeCookie,'',{path:'/api/intake',maxAge:0,httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict'});return response;}catch(e){return intakeError(e);}}
