// The assistant's tool loop, independent of the model provider: a ModelDriver (drivers/anthropic.ts,
// drivers/openai.ts) talks to the API and keeps the conversation in its own format; this loop runs the tools.
// Read tools run right away; write tools never run here: they become proposals the user confirms in the chat
// (POST /api/assistant/actions executes them with the user's own permissions). Every input is validated against
// the tool's schema. Free of server-only code: tests/agents.test.ts drives it with a scripted driver.
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
// A tool call as the driver understood it; `invalid` when its arguments could not be read at all.
export type ToolCall = { id: string; name: string; input: unknown; invalid?: boolean };
export type ToolOutcome = { id: string; content: string; isError?: boolean };
export type Usage = { input: number; output: number; cacheRead: number };
// end: the answer is complete · tools: run `calls` and continue · continue: ask again without results (a paused
// server turn) · refusal: the model declined · truncated: a tool call was cut off by the output limit.
export type TurnResult = { calls: ToolCall[]; stop: 'end' | 'tools' | 'continue' | 'refusal' | 'truncated'; usage: Usage };
export interface ModelDriver { next(onText: (delta: string) => void): Promise<TurnResult>; pushResults(results: ToolOutcome[]): void }
export type LoopResult = { answer: string; tools: string[]; proposals: number; usage: Usage; stop: string };
export async function runAgentLoop({ driver, tools, emit, maxTurns = 8 }: { driver: ModelDriver; tools: AgentTool[]; emit: (event: AgentEvent) => void; maxTurns?: number }): Promise<LoopResult> {
  const byName = new Map(tools.map(tool => [tool.name, tool]));
  const used: string[] = [];
  const usage: Usage = { input: 0, output: 0, cacheRead: 0 };
  let answer = '', proposals = 0, stop = 'end';
  for (let turn = 0; turn < maxTurns; turn++) {
    // Text from a new model turn starts its own paragraph.
    let started = false;
    const result = await driver.next(delta => {
      if (!started && answer && !answer.endsWith('\n')) { answer += '\n\n'; emit({ type: 'text', delta: '\n\n' }); }
      started = true; answer += delta; emit({ type: 'text', delta });
    });
    usage.input += result.usage.input; usage.output += result.usage.output; usage.cacheRead += result.usage.cacheRead;
    stop = result.stop;
    if (result.stop === 'refusal') { emit({ type: 'notice', code: 'REFUSAL', text: 'El asistente no puede ayudar con esta solicitud. Reformúlala o consúltala con Ale.' }); break; }
    if (result.stop === 'truncated') { emit({ type: 'notice', code: 'TRUNCATED', text: 'La respuesta se cortó antes de terminar. Pide algo más acotado.' }); break; }
    if (result.stop === 'continue') continue;
    if (result.stop === 'end' || !result.calls.length) break;
    // Every result goes back together so the model keeps calling tools in parallel.
    const outcomes = await Promise.all(result.calls.map(async (call): Promise<ToolOutcome> => {
      const tool = byName.get(call.name);
      if (!tool) return { id: call.id, content: `Herramienta desconocida: ${call.name}`, isError: true };
      const parsed = call.invalid ? { ok: false as const } : tool.parse(call.input);
      if (!parsed.ok) return { id: call.id, content: JSON.stringify({ INVALID_JSON: JSON.stringify(call.input) }), isError: true };
      used.push(call.name);
      const text = tool.label(parsed.data);
      emit({ type: 'step', id: call.id, text, status: 'active' });
      try {
        if (tool.write) {
          const proposal = await tool.propose(parsed.data);
          proposals++;
          emit({ type: 'proposal', id: call.id, tool: call.name, input: parsed.data, ...proposal });
          emit({ type: 'step', id: call.id, text, status: 'complete' });
          return { id: call.id, content: 'Propuesta mostrada a la persona para que la confirme. Todavía no está hecha: no digas que ya ocurrió.' };
        }
        const output = await tool.run(parsed.data);
        emit({ type: 'step', id: call.id, text, status: 'complete' });
        return { id: call.id, content: typeof output === 'string' ? output : JSON.stringify(output) };
      } catch (error) {
        emit({ type: 'step', id: call.id, text, status: 'error' });
        const code = typeof (error as { code?: unknown })?.code === 'string' ? (error as { code: string }).code : 'ERROR';
        return { id: call.id, content: `No se pudo completar: ${code}`, isError: true };
      }
    }));
    driver.pushResults(outcomes);
    if (turn === maxTurns - 1) { stop = 'turn_limit'; emit({ type: 'notice', code: 'TURN_LIMIT', text: 'Llegué al límite de consultas para una respuesta. Pregunta de nuevo con algo más específico.' }); }
  }
  return { answer, tools: [...new Set(used)], proposals, usage, stop };
}
