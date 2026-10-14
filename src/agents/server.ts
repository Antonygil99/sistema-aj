import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import type { BetaMessageParam } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import { getDb } from '@/lib/db';
import type { Actor } from '@/lib/api';
import { hasRole, type AccessRole } from '@/lib/access-policy';
import { getPreferences } from '@/modules/preferences-server';
import { assistantModels } from '@/modules/preferences';
import { agentById, isWriteTool, type AgentId } from './catalog';
import { systemPrompt } from './prompts';
import { runAgentLoop, type AgentEvent } from './loop';
import { loopTools, toolDefinitions } from './tools';
export const aiConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY?.trim());
export type ChatTurn = { role: 'user' | 'assistant'; text: string };
const roleLabels: Record<AccessRole, string> = { USER: 'consulta', ADMIN: 'administrador', SUPERADMIN: 'superadministrador' };
// Errors the browser can explain; Anthropic's own messages never reach it.
export function aiErrorCode(error: unknown) {
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) return 'AI_NOT_CONFIGURED';
  if (error instanceof Anthropic.RateLimitError) return 'AI_RATE_LIMITED';
  if (error instanceof Anthropic.BadRequestError) return 'AI_REJECTED';
  if (error instanceof Anthropic.APIError) return 'AI_UNAVAILABLE';
  return 'AI_UNAVAILABLE';
}
// One assistant turn: history (plain text of earlier turns) + the new message, streamed as AgentEvents.
export async function runAssistantTurn({ agentId, history, message, think, actor, role, userId, signal, emit }: { agentId: AgentId; history: ChatTurn[]; message: string; think: boolean; actor: Actor; role: AccessRole; userId: string | null; signal: AbortSignal; emit: (event: AgentEvent) => void }) {
  const agent = agentById(agentId)!;
  const email = actor.email;
  const preferences = email ? await getPreferences(email) : null;
  const model = preferences?.assistantModel ?? 'claude-haiku-5-5';
  const now = new Date();
  // People with read-only access get only the read tools, so nothing is ever proposed to them.
  const names = agent.tools.filter(name => hasRole(role, 'ADMIN') || !isWriteTool(name));
  const ctx = { actor, userId, email, now };
  const client = new Anthropic({ maxRetries: 2 });
  // Server-side fallback on a policy decline: Claude Sonnet 5.5 on the Claude API; Claude Haiku 5.5 has none.
  const fallback = model === 'claude-sonnet-5-5' ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {};
  const base = {
    model, max_tokens: 16000,
    system: [{ type: 'text' as const, text: systemPrompt(agent.id as AgentId), cache_control: { type: 'ephemeral' as const } }],
    tools: toolDefinitions(names),
    thinking: { type: 'adaptive' as const },
    // Kept low on purpose (cost): "Pensar a fondo" raises it to medium.
    output_config: { effort: think ? 'medium' as const : 'low' as const },
    ...fallback,
  };
  const context = `Contexto de esta conversación (del sistema, no del usuario): hoy es ${new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now)}. Hablas con ${actor.name}${email ? ` (${email})` : ''}, rol ${roleLabels[role]}.${hasRole(role, 'ADMIN') ? '' : ' Tiene acceso de consulta: no puede confirmar acciones, así que no las propongas.'}`;
  const messages: BetaMessageParam[] = [...history.map(turn => ({ role: turn.role, content: turn.text })), { role: 'user', content: message }, { role: 'system', content: context }];
  const started = Date.now();
  try {
    const result = await runAgentLoop({ createStream: params => client.beta.messages.stream({ ...base, messages: params }, { signal }), messages, tools: loopTools(names, ctx), emit });
    await logRun(agentId, 'DONE', { question: message.slice(0, 2000), by: email, model, think }, { answer: result.answer.slice(0, 8000), tools: result.tools, proposals: result.proposals, usage: result.usage, stop: result.stop, ms: Date.now() - started });
    emit({ type: 'done' });
  } catch (error) {
    if (signal.aborted) { await logRun(agentId, 'STOPPED', { question: message.slice(0, 2000), by: email, model, think }, null); return; }
    const code = aiErrorCode(error);
    console.error('AI_TURN_FAILED', code);
    await logRun(agentId, 'ERROR', { question: message.slice(0, 2000), by: email, model, think }, null, code);
    emit({ type: 'error', code, text: code });
  }
}
async function logRun(agent: string, status: string, input: Record<string, unknown>, output: Record<string, unknown> | null, error?: string) {
  try { await getDb().agentRun.create({ data: { agent, status, input: JSON.parse(JSON.stringify(input)), output: output ? JSON.parse(JSON.stringify(output)) : undefined, error } }); }
  catch { console.error('AGENT_RUN_LOG_FAILED'); }
}
export const modelLabel = (id: string) => assistantModels.find(model => model.id === id)?.label ?? id;
