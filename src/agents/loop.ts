// The assistant's tool loop, free of server-only code so tests/agents.test.ts can drive it with a scripted stream.
// Read tools run right away; write tools never run here: they become proposals the user confirms in the chat
// (POST /api/assistant/actions executes them with the user's own permissions). Streaming manual loop per the Claude
// API guidance: validate every tool input against its schema, stop on refusal or on a tool call cut off at
// max_tokens, resume pause_turn, and re-issue a turn only when the SDK could not parse a tool input at all.
import Anthropic from '@anthropic-ai/sdk';
import type { BetaMessage, BetaMessageParam, BetaToolResultBlockParam, BetaToolUseBlock } from '@anthropic-ai/sdk/resources/beta/messages/messages';
export type Proposal = { title: string; details: [string, string][] };
export type AgentTool = {
  name: string; write: boolean;
  parse: (input: unknown) => { ok: true; data: unknown } | { ok: false };
  label: (input: unknown) => string;
  run: (input: unknown) => Promise<unknown>;
  propose: (input: unknown) => Promise<Proposal>;
};
export type AgentEvent =
  | { type: 'step'; id: string; text: string; status: 'active' | 'complete' | 'error' }
  | { type: 'text'; delta: string }
  | { type: 'proposal'; id: string; tool: string; input: unknown; title: string; details: [string, string][] }
  | { type: 'notice'; code: 'REFUSAL' | 'TRUNCATED' | 'TURN_LIMIT'; text: string }
  | { type: 'done' }
  | { type: 'error'; code: string; text: string };
export type StreamLike = { on(event: 'text', listener: (delta: string) => void): unknown; finalMessage(): Promise<BetaMessage> };
export type LoopResult = { answer: string; tools: string[]; proposals: number; usage: { input: number; output: number; cacheRead: number }; stop: string };
const MAX_JSON_RETRIES = 2;
const errorResult = (id: string, content: string): BetaToolResultBlockParam => ({ type: 'tool_result', tool_use_id: id, is_error: true, content });
export async function runAgentLoop({ createStream, messages, tools, emit, maxTurns = 8 }: { createStream: (messages: BetaMessageParam[]) => StreamLike; messages: BetaMessageParam[]; tools: AgentTool[]; emit: (event: AgentEvent) => void; maxTurns?: number }): Promise<LoopResult> {
  const byName = new Map(tools.map(tool => [tool.name, tool]));
  const used: string[] = [];
  const usage = { input: 0, output: 0, cacheRead: 0 };
  let answer = '', proposals = 0, jsonRetries = 0, stop = 'end_turn';
  for (let turn = 0; turn < maxTurns; turn++) {
    const stream = createStream(messages);
    // Text from a new model turn starts its own paragraph.
    let started = false;
    stream.on('text', delta => {
      if (!started && answer && !answer.endsWith('\n')) { answer += '\n\n'; emit({ type: 'text', delta: '\n\n' }); }
      started = true; answer += delta; emit({ type: 'text', delta });
    });
    let message: BetaMessage;
    try {
      message = await stream.finalMessage();
      jsonRetries = 0;
    } catch (error) {
      // Only an unparseable tool input is retried; API errors (auth, rate limit, aborts) go to the caller.
      if (error instanceof Anthropic.APIError || (error as Error)?.name === 'AbortError' || jsonRetries++ >= MAX_JSON_RETRIES) throw error;
      turn--;
      continue;
    }
    usage.input += message.usage.input_tokens; usage.output += message.usage.output_tokens; usage.cacheRead += message.usage.cache_read_input_tokens ?? 0;
    stop = message.stop_reason ?? 'end_turn';
    if (stop === 'refusal') { emit({ type: 'notice', code: 'REFUSAL', text: 'El asistente no puede ayudar con esta solicitud. Reformúlala o consúltala con Ale.' }); break; }
    if (stop === 'pause_turn') { messages.push({ role: 'assistant', content: message.content }); continue; }
    const calls = message.content.filter((block): block is BetaToolUseBlock => block.type === 'tool_use');
    if (!calls.length) break;
    if (stop === 'max_tokens') { emit({ type: 'notice', code: 'TRUNCATED', text: 'La respuesta se cortó antes de terminar. Pide algo más acotado.' }); break; }
    messages.push({ role: 'assistant', content: message.content });
    // Every result goes back in a single user message so the model keeps calling tools in parallel.
    const results = await Promise.all(calls.map(async (call): Promise<BetaToolResultBlockParam> => {
      const tool = byName.get(call.name);
      if (!tool) return errorResult(call.id, `Herramienta desconocida: ${call.name}`);
      const parsed = tool.parse(call.input);
      if (!parsed.ok) return errorResult(call.id, JSON.stringify({ INVALID_JSON: JSON.stringify(call.input) }));
      used.push(call.name);
      const text = tool.label(parsed.data);
      emit({ type: 'step', id: call.id, text, status: 'active' });
      try {
        if (tool.write) {
          const proposal = await tool.propose(parsed.data);
          proposals++;
          emit({ type: 'proposal', id: call.id, tool: call.name, input: parsed.data, ...proposal });
          emit({ type: 'step', id: call.id, text, status: 'complete' });
          return { type: 'tool_result', tool_use_id: call.id, content: 'Propuesta mostrada a la persona para que la confirme. Todavía no está hecha: no digas que ya ocurrió.' };
        }
        const output = await tool.run(parsed.data);
        emit({ type: 'step', id: call.id, text, status: 'complete' });
        return { type: 'tool_result', tool_use_id: call.id, content: typeof output === 'string' ? output : JSON.stringify(output) };
      } catch (error) {
        emit({ type: 'step', id: call.id, text, status: 'error' });
        const code = typeof (error as { code?: unknown })?.code === 'string' ? (error as { code: string }).code : 'ERROR';
        return errorResult(call.id, `No se pudo completar: ${code}`);
      }
    }));
    messages.push({ role: 'user', content: results });
    if (turn === maxTurns - 1) { stop = 'turn_limit'; emit({ type: 'notice', code: 'TURN_LIMIT', text: 'Llegué al límite de consultas para una respuesta. Pregunta de nuevo con algo más específico.' }); }
  }
  return { answer, tools: [...new Set(used)], proposals, usage, stop };
}
