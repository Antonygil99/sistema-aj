import { authenticate, apiError } from '@/lib/api';
import { syncWhatsAppEvents } from '@/modules/whatsapp/server';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  const auth = await authenticate(request, 'ADMIN'); if (auth.denied) return auth.denied;
  try { await syncWhatsAppEvents(); return Response.json({synced:true}, { headers: { 'Cache-Control': 'private, no-store' } }); }
  catch (error) { return apiError(error); }
}
