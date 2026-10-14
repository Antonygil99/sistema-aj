import { authorize } from '@/lib/api';
import { agents } from '@/agents/catalog';
import { aiConfigured } from '@/agents/server';
// The assistants and whether the Claude API is configured; the chat itself is POST /api/assistant/chat.
export async function GET(request: Request) {
  const denied = await authorize(request); if (denied) return denied;
  return Response.json({ data: agents.map(({ id, name, short, purpose, tools }) => ({ id, name, short, purpose, tools })), configured: aiConfigured() });
}
