import { authorize } from '@/lib/api';
import { agents } from '@/agents/catalog';
export async function GET(request: Request) {
  const denied = await authorize(request); if (denied) return denied;
  return Response.json({ data: agents, runtime: 'pending_eve_adapter' });
}
