import 'server-only';
import { NextResponse } from 'next/server';
import { ResourceError } from '@/modules/resources/rules';
export const privateHeaders={'Cache-Control':'no-store, private','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff'};
export function intakeJson(value:unknown,status=200){return NextResponse.json(value,{status,headers:privateHeaders});}
export function publicOrigin(request:Request){
  const base=process.env.BETTER_AUTH_URL;
  if(!base||request.headers.get('origin')!==new URL(base).origin)throw new ResourceError('INVALID_ORIGIN',403);
}
export async function intakeBody(request:Request){
  if(!request.headers.get('content-type')?.startsWith('application/json'))throw new ResourceError('INVALID_INPUT',400);
  const max=16*1024,length=Number(request.headers.get('content-length'));
  if(length>max)throw new ResourceError('INTAKE_BODY_TOO_LARGE',413);
  const reader=request.body?.getReader();if(!reader)throw new ResourceError('INVALID_INPUT',400);
  const parts:Uint8Array[]=[];let size=0;
  try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw new ResourceError('INTAKE_BODY_TOO_LARGE',413);}parts.push(value);}}finally{reader.releaseLock();}
  return JSON.parse(Buffer.concat(parts).toString('utf8'));
}
export function intakeError(error:unknown){
  const code=(error as {code?:string}).code,status=(error as {status?:number}).status;
  if(code&&status)return intakeJson({error:code},status);
  if(error instanceof SyntaxError || (error as {name?:string}).name==='ZodError')return intakeJson({error:'INVALID_INPUT'},400);
  return intakeJson({error:'SERVICE_UNAVAILABLE'},503);
}
