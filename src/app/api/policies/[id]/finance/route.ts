import {driveEvidenceOptions} from '@/modules/drive/server';
import { authenticate, apiError } from '@/lib/api';
import { policyFinance } from '@/modules/polizas/finance-server';
export const runtime = 'nodejs';
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authenticate(request); if (auth.denied) return auth.denied;
  try { const data=await policyFinance((await context.params).id);let driveEvidence:Awaited<ReturnType<typeof driveEvidenceOptions>>=[],driveError:string|null=null;try{driveEvidence=await driveEvidenceOptions(data.policy.clientId,auth.actor,request.headers);}catch{driveError='No se pudo consultar Drive. Revisa tu conexión o vuelve a intentarlo.';}return Response.json({...data,evidence:[...data.evidence,...driveEvidence],driveError}, { headers: { 'Cache-Control': 'private, no-store' } }); }
  catch (error) { return apiError(error); }
}
