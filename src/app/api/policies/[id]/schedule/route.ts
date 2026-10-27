import { authenticate, apiError } from '@/lib/api';
import { createPolicySchedule } from '@/modules/polizas/finance-server';
export const runtime = 'nodejs';
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authenticate(request,'ADMIN'); if (auth.denied) return auth.denied;
  try { await createPolicySchedule((await context.params).id,await request.json(),auth.actor); return Response.json({ saved:true }); }
  catch (error) { return apiError(error); }
}
