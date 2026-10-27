import { authenticate, apiError } from '@/lib/api';
import { policyFinance } from '@/modules/polizas/finance-server';
export const runtime = 'nodejs';
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authenticate(request); if (auth.denied) return auth.denied;
  try { return Response.json(await policyFinance((await context.params).id), { headers: { 'Cache-Control': 'private, no-store' } }); }
  catch (error) { return apiError(error); }
}
