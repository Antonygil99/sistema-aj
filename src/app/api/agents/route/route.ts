import { z } from 'zod';
import { authorize, apiError } from '@/lib/api';
import { selectAgent, agents } from '@/agents/catalog';
export async function POST(request: Request) {
  const denied = authorize(request); if (denied) return denied;
  try {
    const input = z.object({ topic: z.enum(['general','venta','siniestro','renovacion','administracion']), message: z.string().trim().min(1).max(10000) }).strict().parse(await request.json());
    const agent = selectAgent(input.topic);
    return Response.json({ agent, definition: agents[agent], execution: 'not_configured', requiresApproval: true });
  } catch (error) { return apiError(error); }
}
