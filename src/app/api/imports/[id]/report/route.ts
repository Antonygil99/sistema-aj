import { human } from '@/modules/mcp/human';
import { importReport } from '@/modules/imports/server';
import { apiError } from '@/lib/api';
export const runtime='nodejs';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{const {id}=await params;return new Response(await importReport(await human(request),id),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="AJ-importacion.csv"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}catch(error){return apiError(error);}}
