import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, apiError } from '@/lib/api';
import { agents } from '@/agents/catalog';
import { aiConfigured, runAssistantTurn } from '@/agents/server';
import type { AgentEvent } from '@/agents/loop';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const chatInput = z.object({
  agent: z.enum(agents.map(agent => agent.id) as [string, ...string[]]),
  message: z.string().trim().min(1).max(4000),
  think: z.boolean().default(true),
  // Earlier turns as plain text; the browser keeps the conversation, the server keeps no transcript beyond AgentRun.
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().max(8000) }).strict()).max(20).default([]),
}).strict();
// One assistant turn streamed as newline-delimited JSON events (steps, text, proposals, done or error).
export async function POST(request: Request) {
  const auth = await authenticate(request); if (auth.denied) return auth.denied;
  let input: z.infer<typeof chatInput>;
  try { input = chatInput.parse(await request.json()); } catch (error) { return apiError(error); }
  if (!aiConfigured()) return NextResponse.json({ error: 'AI_NOT_CONFIGURED' }, { status: 503 });
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: AgentEvent) => { try { controller.enqueue(encoder.encode(JSON.stringify(event) + '\n')); } catch { /* the reader went away */ } };
      // The first non-empty history turn must come from the user.
      const history = input.history.filter(turn => turn.text.trim()).slice(-20);
      while (history[0]?.role === 'assistant') history.shift();
      await runAssistantTurn({ agentId: input.agent as never, history, message: input.message, think: input.think, actor: auth.actor, role: auth.actor.role, userId: auth.actor.id, signal: request.signal, emit });
      try { controller.close(); } catch { /* already closed */ }
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store, no-transform', 'X-Accel-Buffering': 'no' } });
}
