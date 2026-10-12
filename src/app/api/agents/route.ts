import { authorize } from '@/lib/api';
import { agents } from '@/agents/catalog';
export function GET(request: Request) {
  const denied = authorize(request); if (denied) return denied;
  return Response.json({ data: agents, runtime: 'pending_eve_adapter' });
}
