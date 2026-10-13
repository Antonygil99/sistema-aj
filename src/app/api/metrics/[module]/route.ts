import { NextResponse } from 'next/server';
import { z } from 'zod';
import { modules } from '@/modules/catalog';
import { authorize,apiError } from '@/lib/api';
import { moduleMetrics } from '@/modules/metrics/module-server';
export async function GET(request:Request,{params}:{params:Promise<{module:string}>}){
 const denied=await authorize(request);if(denied)return denied;
 const {module}=await params;const entry=modules.find(item=>item.slug===module);if(!entry)return NextResponse.json({error:'NOT_FOUND'},{status:404});
 try{const clientId=z.string().min(1).max(100).nullable().parse(new URL(request.url).searchParams.get('clientId'));if(clientId&&entry.slug!=='documentos')return NextResponse.json({error:'INVALID_SCOPE'},{status:400});return NextResponse.json({data:await moduleMetrics(entry.slug,clientId)},{headers:{'Cache-Control':'no-store'}});}
 catch(error){if(error instanceof Error&&error.message==='METRICS_SCOPE_NOT_FOUND')return NextResponse.json({error:'NOT_FOUND'},{status:404});return apiError(error);}
}
