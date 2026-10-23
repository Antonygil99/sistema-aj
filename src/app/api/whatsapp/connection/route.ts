import { authenticate } from '@/lib/api';
import { checkWhatsAppConnection } from '@/modules/whatsapp/connection';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  const auth = await authenticate(request, 'ADMIN'); if (auth.denied) return auth.denied;
  const headers = { 'Cache-Control': 'private, no-store' };
  return Response.json(await checkWhatsAppConnection(), { headers });
}
