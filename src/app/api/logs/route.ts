import { authenticate, apiError } from '@/lib/api';
import { auditFilters } from '@/modules/audit';
import { auditHistory } from '@/modules/audit-server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const auth = await authenticate(request, 'SUPERADMIN'); if (auth.denied) return auth.denied;
  try {
    const filters = auditFilters.parse(Object.fromEntries(new URL(request.url).searchParams));
    return Response.json(await auditHistory(filters), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return apiError(error); }
}
