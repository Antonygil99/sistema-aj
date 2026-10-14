import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import type { BetaMessageParam } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import type { ResponseInputItem } from 'openai/resources/responses/responses';
import { getDb } from '@/lib/db';
import type { Actor } from '@/lib/api';
import { hasRole, type AccessRole } from '@/lib/access-policy';
import { getPreferences } from '@/modules/preferences-server';
import { assistantModels, providerLabels, type AssistantModel, type AssistantProvider } from '@/modules/preferences';
import { agentById, isWriteTool, type AgentId } from './catalog';
import { systemPrompt } from './prompts';
import { runAgentLoop, type AgentEvent, type ModelDriver } from './loop';
import { loopTools, toolSpecs, type ToolSpec } from './tools';
import { anthropicDriver } from './drivers/anthropic';
import { openaiDriver } from './drivers/openai';
const keys: Record<AssistantProvider, () => string | undefined> = { anthropic: () => process.env.ANTHROPIC_API_KEY?.trim(), openai: () => process.env.OPENAI_API_KEY?.trim() };
export const providerOf = (model: AssistantModel): AssistantProvider => assistantModels.find(item => item.id === model)?.provider ?? 'anthropic';
export const providerConfigured = (provider: AssistantProvider) => Boolean(keys[provider]());
export const aiConfigured = () => providerConfigured('anthropic') || providerConfigured('openai');
export type ChatTurn = { role: 'user' | 'assistant'; text: string };
const roleLabels: Record<AccessRole, string> = { USER: 'consulta', ADMIN: 'administrador', SUPERADMIN: 'superadministrador' };
// Errors the browser can explain; the providers' own messages never reach it.
export function aiErrorCode(error: unknown) {
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError || error instanceof OpenAI.AuthenticationError || error instanceof OpenAI.PermissionDeniedError) return 'AI_NOT_CONFIGURED';
  if (error instanceof Anthropic.RateLimitError || error instanceof OpenAI.RateLimitError) return 'AI_RATE_LIMITED';
  if (error instanceof Anthropic.BadRequestError || error instanceof OpenAI.BadRequestError) return 'AI_REJECTED';
  return 'AI_UNAVAILABLE';
}
// Claude: adaptive thinking, low effort for cost ("Pensar a fondo" → medium), cached system prompt, tool inputs
// streamed eagerly, the date/user/role in a mid-conversation system message, refusal fallback on Sonnet only.
function claudeDriver(model: AssistantModel, prompt: string, specs: ToolSpec[], history: ChatTurn[], message: string, context: string, think: boolean, signal: AbortSignal): ModelDriver {
  const client = new Anthropic({ apiKey: keys.anthropic(), maxRetries: 2 });
  const fallback = model === 'claude-sonnet-5-5' ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {};
  const base = {
    model, max_tokens: 16000,
    system: [{ type: 'text' as const, text: prompt, cache_control: { type: 'ephemeral' as const } }],
    tools: specs.map(spec => ({ name: spec.name, description: spec.description, input_schema: spec.schema, eager_input_streaming: true })),
    thinking: { type: 'adaptive' as const },
    output_config: { effort: think ? 'medium' as const : 'low' as const },
    ...fallback,
  };
  const messages: BetaMessageParam[] = [...history.map(turn => ({ role: turn.role, content: turn.text })), { role: 'user', content: message }, { role: 'system', content: context }];
  return anthropicDriver({ createStream: params => client.beta.messages.stream({ ...base, messages: params }, { signal }), messages });
}
// OpenAI: Responses API, low reasoning effort ("Pensar a fondo" → medium), store: false so OpenAI keeps no copy of
// the conversation (reasoning travels back encrypted), the date/user/role as a developer message.
function gptDriver(model: AssistantModel, prompt: string, specs: ToolSpec[], history: ChatTurn[], message: string, context: string, think: boolean, signal: AbortSignal): ModelDriver {
  const client = new OpenAI({ apiKey: keys.openai(), maxRetries: 2 });
  const tools = specs.map(spec => ({ type: 'function' as const, name: spec.name, description: spec.description, parameters: spec.schema, strict: false }));
  const input: ResponseInputItem[] = [...history.map(turn => ({ role: turn.role, content: turn.text })), { role: 'user', content: message }, { role: 'developer', content: context }];
  return openaiDriver({
    createStream: items => client.responses.stream({ model, instructions: prompt, input: items, tools, reasoning: { effort: think ? 'medium' : 'low' }, max_output_tokens: 16000, store: false, include: ['reasoning.encrypted_content'] }, { signal }),
    input,
  });
}
// One assistant turn: history (plain text of earlier turns) + the new message, streamed as AgentEvents.
export async function runAssistantTurn({ agentId, history, message, think, actor, role, userId, signal, emit }: { agentId: AgentId; history: ChatTurn[]; message: string; think: boolean; actor: Actor; role: AccessRole; userId: string | null; signal: AbortSignal; emit: (event: AgentEvent) => void }) {
  const agent = agentById(agentId)!;
  const email = actor.email;
  const preferences = email ? await getPreferences(email) : null;
  const model = preferences?.assistantModel ?? 'claude-haiku-5-5';
  const provider = providerOf(model);
  if (!providerConfigured(provider)) { emit({ type: 'error', code: provider === 'openai' ? 'AI_OPENAI_NOT_CONFIGURED' : 'AI_ANTHROPIC_NOT_CONFIGURED', text: '' }); return; }
  const now = new Date();
  // Write tools need ADMIN or above, so nothing is ever proposed to a read-only account.
  const names = agent.tools.filter(name => hasRole(role, 'ADMIN') || !isWriteTool(name));
  const context = `Contexto de esta conversación (del sistema, no del usuario): hoy es ${new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now)}. Hablas con ${actor.name}${email ? ` (${email})` : ''}, rol ${roleLabels[role]}.${hasRole(role, 'ADMIN') ? '' : ' Tiene acceso de consulta: no puede confirmar acciones, así que no las propongas.'}`;
  const build = provider === 'openai' ? gptDriver : claudeDriver;
  const driver = build(model, systemPrompt(agent.id as AgentId), toolSpecs(names), history, message, context, think, signal);
  const started = Date.now();
  const input = { question: message.slice(0, 2000), by: email, model, provider, think };
  try {
    const result = await runAgentLoop({ driver, tools: loopTools(names, { actor, userId, email, now }), emit });
    await logRun(agentId, 'DONE', input, { answer: result.answer.slice(0, 8000), tools: result.tools, proposals: result.proposals, usage: result.usage, stop: result.stop, ms: Date.now() - started });
    emit({ type: 'done' });
  } catch (error) {
    if (signal.aborted) { await logRun(agentId, 'STOPPED', input, null); return; }
    const code = aiErrorCode(error);
    console.error('AI_TURN_FAILED', provider, code);
    await logRun(agentId, 'ERROR', input, null, code);
    emit({ type: 'error', code, text: code });
  }
}
async function logRun(agent: string, status: string, input: Record<string, unknown>, output: Record<string, unknown> | null, error?: string) {
  try { await getDb().agentRun.create({ data: { agent, status, input: JSON.parse(JSON.stringify(input)), output: output ? JSON.parse(JSON.stringify(output)) : undefined, error } }); }
  catch { console.error('AGENT_RUN_LOG_FAILED'); }
}
export function modelLabel(id: string) {
  const model = assistantModels.find(item => item.id === id);
  return model ? `${model.label} · ${providerLabels[model.provider]}` : id;
}
