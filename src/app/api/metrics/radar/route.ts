import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authorize,apiError } from '@/lib/api';
import { radar } from '@/modules/metrics/radar';
export async function GET(request:Request){const denied=await authorize(request);if(denied)return denied;try{const url=new URL(request.url);const kind=z.enum(['renewals','payments']).parse(url.searchParams.get('kind'));const skip=z.coerce.number().int().min(0).max(100000).parse(url.searchParams.get('skip')??0);return NextResponse.json({data:await radar(kind,skip)},{headers:{'Cache-Control':'no-store'}});}catch(e){return apiError(e);}}
