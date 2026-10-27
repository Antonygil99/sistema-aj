import { authenticate, apiError } from '@/lib/api';
import { renewPolicy } from '@/modules/polizas/finance-server';
export const runtime = 'nodejs';
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authenticate(request,'ADMIN'); if (auth.denied) return auth.denied;
  try { return Response.json(await renewPolicy((await context.params).id,await request.json(),auth.actor),{status:201}); }
  catch (error) { return apiError(error); }
}
