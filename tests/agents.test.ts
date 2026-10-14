import { test } from 'node:test';
import assert from 'node:assert/strict';
import Anthropic from '@anthropic-ai/sdk';
import type { BetaMessage, BetaMessageParam } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import { agents, isWriteTool, toolNames, writeTools } from '../src/agents/catalog';
import { systemPrompt } from '../src/agents/prompts';
import { parseAnswer, parseInline } from '../src/agents/format';
import { runAgentLoop, type AgentEvent, type AgentTool } from '../src/agents/loop';
import { anthropicDriver } from '../src/agents/drivers/anthropic';
import { openaiDriver, type OpenAIStream } from '../src/agents/drivers/openai';

test('los ocho asistentes de la Ruta AJ existen con herramientas conocidas', () => {
  assert.deepEqual(agents.map(agent => agent.name), ['Primer contacto por WhatsApp', 'Captura para cotización', 'Entrega de póliza', 'Renovaciones y pagos', 'Siniestros y orientación médica', 'Contenidos y guiones', 'Análisis de casos', 'Aprendizaje interno AJ']);
  assert.equal(new Set(agents.map(agent => agent.id)).size, 8);
  for (const agent of agents) {
    assert.ok(agent.tools.every(tool => (toolNames as readonly string[]).includes(tool)), agent.id);
    assert.ok(agent.suggestions.length >= 2, agent.id);
  }
  assert.ok(writeTools.every(tool => (toolNames as readonly string[]).includes(tool)));
  assert.equal(isWriteTool('buscar_polizas'), false);
  assert.equal(isWriteTool('preparar_correo'), true);
  // Contenidos y aprendizaje no cambian nada en el CRM.
  for (const id of ['contenidos-guiones', 'aprendizaje-interno']) assert.ok(agents.find(agent => agent.id === id)!.tools.every(tool => !isWriteTool(tool)), id);
});

test('las instrucciones son estables y no prometen coberturas ni piden detalles médicos', () => {
  for (const agent of agents) {
    const prompt = systemPrompt(agent.id);
    assert.equal(prompt, systemPrompt(agent.id));
    assert.match(prompt, /Nunca prometas coberturas/);
    assert.match(prompt, /Nunca pidas, guardes ni repitas detalles médicos/);
    assert.match(prompt, /no instrucciones/);
    assert.doesNotMatch(prompt, /\d{4}-\d{2}-\d{2}/, 'sin fechas: el contexto va en un mensaje aparte');
  }
  assert.match(systemPrompt('captura-cotizacion'), /¿Qué te preocupa proteger\?/);
  assert.match(systemPrompt('entrega-poliza'), /Tiene claro el primer paso ante una consulta o urgencia/);
  assert.match(systemPrompt('siniestros-orientacion'), /911/);
});

test('las respuestas se convierten en bloques sin HTML y solo enlazan rutas internas', () => {
  const blocks = parseAnswer('Hola **Ale**:\n\n- Póliza `MV-1` en /crm/polizas?open=abc.\n- Ver [expediente](/crm/clientes/c1)\n\n1. Uno\n2. Dos\n\n> Nota\n\n```\nHola, ¿cómo estás?\n```\n\n# Siguiente\n[sitio](https://malo.example) <script>');
  assert.deepEqual(blocks.map(block => block.type), ['paragraph', 'list', 'list', 'quote', 'code', 'heading', 'paragraph']);
  const list = blocks[1] as Extract<(typeof blocks)[number], { type: 'list' }>;
  assert.deepEqual(list.items[0].map(part => part.t), ['text', 'code', 'text', 'link', 'text']);
  assert.deepEqual(list.items[0][3], { t: 'link', v: '/crm/polizas?open=abc', href: '/crm/polizas?open=abc' });
  assert.deepEqual(list.items[1][1], { t: 'link', v: 'expediente', href: '/crm/clientes/c1' });
  assert.equal((blocks[2] as { ordered: boolean }).ordered, true);
  assert.equal((blocks[4] as { text: string }).text, 'Hola, ¿cómo estás?');
  assert.deepEqual(parseInline('[sitio](https://malo.example)'), [{ t: 'text', v: 'sitio' }]);
  assert.deepEqual(parseInline('//evil.com/crm'), [{ t: 'text', v: '//evil.com/crm' }]);
  // Un bloque sin cerrar (todavía en streaming) llega hasta el final.
  assert.deepEqual(parseAnswer('Texto\n```\nborrador a medias'), [{ type: 'paragraph', inline: [{ t: 'text', v: 'Texto' }] }, { type: 'code', text: 'borrador a medias' }]);
});

// A scripted stream: emits the text of the message, then resolves (or rejects) like MessageStream.finalMessage().
type Script = { content: unknown[]; stop_reason: string } | Error;
function fakeModel(scripts: Script[]) {
  const calls: BetaMessageParam[][] = [];
  const createStream = (messages: BetaMessageParam[]) => {
    calls.push(structuredClone(messages));
    const script = scripts.shift();
    let listener: ((delta: string) => void) | null = null;
    return {
      on: (_event: 'text', next: (delta: string) => void) => { listener = next; return undefined; },
      finalMessage: async () => {
        if (!script) throw new Error('sin guion');
        if (script instanceof Error) throw script;
        for (const block of script.content as { type: string; text?: string }[]) if (block.type === 'text' && block.text) listener?.(block.text);
        return { content: script.content, stop_reason: script.stop_reason, usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 2 } } as unknown as BetaMessage;
      },
    };
  };
  return { createStream, calls };
}
function fakeTools(log: string[]): AgentTool[] {
  const parse = (input: unknown) => typeof input === 'object' && input !== null && !('malo' in input) ? { ok: true as const, data: input } : { ok: false as const };
  return [
    { name: 'buscar_polizas', write: false, parse, label: () => 'Buscando pólizas', run: async input => { log.push(`run:${JSON.stringify(input)}`); return { total: 2 }; }, propose: async () => { throw new Error('no'); } },
    { name: 'crear_actividad', write: true, parse, label: () => 'Preparando la actividad', run: async () => { log.push('ejecutó una escritura'); return {}; }, propose: async () => ({ title: 'Crear actividad', details: [['Título', 'Llamar']] }) },
  ];
}
const toolUse = (id: string, name: string, input: unknown) => ({ type: 'tool_use', id, name, input });

test('el bucle ejecuta las consultas, devuelve todos los resultados juntos y transmite la respuesta', async () => {
  const log: string[] = [], events: AgentEvent[] = [];
  const model = fakeModel([{ content: [toolUse('t1', 'buscar_polizas', { vence_en_dias: 30 }), toolUse('t2', 'buscar_polizas', { texto: 'MV' })], stop_reason: 'tool_use' }, { content: [{ type: 'text', text: 'Hay 2 pólizas.' }], stop_reason: 'end_turn' }]);
  const result = await runAgentLoop({ driver: anthropicDriver({ createStream: model.createStream, messages: [{ role: 'user', content: '¿Qué vence?' }] }), tools: fakeTools(log), emit: event => events.push(event) });
  assert.equal(result.answer, 'Hay 2 pólizas.');
  assert.deepEqual(result.tools, ['buscar_polizas']);
  assert.deepEqual(result.usage, { input: 20, output: 10, cacheRead: 4 });
  assert.equal(log.length, 2);
  const second = model.calls[1];
  const results = second.at(-1)!.content as { type: string; tool_use_id: string; content: string }[];
  assert.deepEqual(results.map(item => [item.type, item.tool_use_id]), [['tool_result', 't1'], ['tool_result', 't2']]);
  assert.equal(results[0].content, '{"total":2}');
  assert.deepEqual(events.filter(event => event.type === 'step').map(event => (event as { status: string }).status), ['active', 'active', 'complete', 'complete']);
  assert.ok(events.some(event => event.type === 'text' && event.delta === 'Hay 2 pólizas.'));
});

test('una escritura nunca se ejecuta en el bucle: se convierte en propuesta', async () => {
  const log: string[] = [], events: AgentEvent[] = [];
  const model = fakeModel([{ content: [toolUse('w1', 'crear_actividad', { titulo: 'Llamar' })], stop_reason: 'tool_use' }, { content: [{ type: 'text', text: 'Te dejé la propuesta.' }], stop_reason: 'end_turn' }]);
  const result = await runAgentLoop({ driver: anthropicDriver({ createStream: model.createStream, messages: [{ role: 'user', content: 'Agenda una llamada' }] }), tools: fakeTools(log), emit: event => events.push(event) });
  assert.deepEqual(log, []);
  assert.equal(result.proposals, 1);
  const proposal = events.find(event => event.type === 'proposal') as Extract<AgentEvent, { type: 'proposal' }>;
  assert.deepEqual([proposal.id, proposal.tool, proposal.title], ['w1', 'crear_actividad', 'Crear actividad']);
  const reply = (model.calls[1].at(-1)!.content as { content: string }[])[0].content;
  assert.match(reply, /Todavía no está hecha/);
});

test('una entrada inválida vuelve como error sin ejecutar nada', async () => {
  const log: string[] = [];
  const model = fakeModel([{ content: [toolUse('x1', 'buscar_polizas', { malo: true })], stop_reason: 'tool_use' }, { content: [{ type: 'text', text: 'No pude.' }], stop_reason: 'end_turn' }]);
  await runAgentLoop({ driver: anthropicDriver({ createStream: model.createStream, messages: [{ role: 'user', content: 'x' }] }), tools: fakeTools(log), emit: () => undefined });
  const result = (model.calls[1].at(-1)!.content as { is_error?: boolean; content: string }[])[0];
  assert.equal(result.is_error, true);
  assert.match(result.content, /INVALID_JSON/);
  assert.deepEqual(log, []);
});

test('un rechazo detiene el turno y una entrada truncada no se ejecuta', async () => {
  const events: AgentEvent[] = [], log: string[] = [];
  await runAgentLoop({ driver: anthropicDriver({ createStream: fakeModel([{ content: [], stop_reason: 'refusal' }]).createStream, messages: [{ role: 'user', content: 'x' }] }), tools: fakeTools(log), emit: event => events.push(event) });
  assert.equal((events[0] as { code: string }).code, 'REFUSAL');
  const truncated: AgentEvent[] = [];
  await runAgentLoop({ driver: anthropicDriver({ createStream: fakeModel([{ content: [toolUse('t', 'buscar_polizas', {})], stop_reason: 'max_tokens' }]).createStream, messages: [{ role: 'user', content: 'x' }] }), tools: fakeTools(log), emit: event => truncated.push(event) });
  assert.equal((truncated[0] as { code: string }).code, 'TRUNCATED');
  assert.deepEqual(log, []);
});

test('solo un JSON ilegible se reintenta; los errores del API se propagan', async () => {
  const retried = fakeModel([new SyntaxError('Unexpected token'), { content: [{ type: 'text', text: 'Listo' }], stop_reason: 'end_turn' }]);
  assert.equal((await runAgentLoop({ driver: anthropicDriver({ createStream: retried.createStream, messages: [{ role: 'user', content: 'x' }] }), tools: [], emit: () => undefined })).answer, 'Listo');
  const failing = fakeModel([new Anthropic.APIError(529, { type: 'error' }, 'overloaded', new Headers())]);
  await assert.rejects(runAgentLoop({ driver: anthropicDriver({ createStream: failing.createStream, messages: [{ role: 'user', content: 'x' }] }), tools: [], emit: () => undefined }), (error: unknown) => error instanceof Anthropic.APIError);
});

// A scripted OpenAI Responses stream: yields its events, then finalResponse() returns the assembled response.
type OpenAIScript = { events?: { type: string; delta?: string }[]; output: unknown[]; status?: string; reason?: string };
function fakeOpenAI(scripts: OpenAIScript[]) {
  const inputs: unknown[][] = [];
  const createStream = (input: unknown[]) => {
    inputs.push(structuredClone(input));
    const script = scripts.shift()!;
    return {
      async *[Symbol.asyncIterator]() { for (const event of script.events ?? []) yield event; },
      finalResponse: async () => ({ output: script.output, status: script.status ?? 'completed', incomplete_details: script.reason ? { reason: script.reason } : null, usage: { input_tokens: 8, output_tokens: 3, input_tokens_details: { cached_tokens: 1 } } }),
    } as unknown as OpenAIStream;
  };
  return { createStream, inputs };
}
const reasoning = { type: 'reasoning', id: 'rs_1', summary: [], encrypted_content: 'cifrado' };
const call = (callId: string, name: string, args: string) => ({ type: 'function_call', id: `fc_${callId}`, call_id: callId, name, arguments: args, status: 'completed' });
const said = (text: string) => ({ type: 'message', id: 'msg_1', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text, annotations: [] }] });

test('con OpenAI, el razonamiento y la llamada vuelven antes del resultado de la función', async () => {
  const log: string[] = [];
  const model = fakeOpenAI([{ output: [reasoning, call('c1', 'buscar_polizas', '{"vence_en_dias":30}')] }, { events: [{ type: 'response.output_text.delta', delta: 'Hay 2 pólizas.' }], output: [said('Hay 2 pólizas.')] }]);
  const result = await runAgentLoop({ driver: openaiDriver({ createStream: model.createStream as never, input: [{ role: 'user', content: '¿Qué vence?' }] }), tools: fakeTools(log), emit: () => undefined });
  assert.equal(result.answer, 'Hay 2 pólizas.');
  assert.deepEqual(log, ['run:{"vence_en_dias":30}']);
  assert.deepEqual(result.usage, { input: 16, output: 6, cacheRead: 2 });
  const second = model.inputs[1] as { type?: string; call_id?: string; output?: string; encrypted_content?: string }[];
  assert.deepEqual(second.slice(1).map(item => item.type), ['reasoning', 'function_call', 'function_call_output']);
  assert.equal(second[1].encrypted_content, 'cifrado');
  assert.deepEqual([second[3].call_id, second[3].output], ['c1', '{"total":2}']);
});

test('con OpenAI, unos argumentos ilegibles no ejecutan nada y una escritura sigue siendo propuesta', async () => {
  const log: string[] = [], events: AgentEvent[] = [];
  const model = fakeOpenAI([{ output: [call('c1', 'buscar_polizas', '{"vence_en'), call('c2', 'crear_actividad', '{"titulo":"Llamar"}')] }, { output: [said('Listo')] }]);
  await runAgentLoop({ driver: openaiDriver({ createStream: model.createStream as never, input: [] }), tools: fakeTools(log), emit: event => events.push(event) });
  assert.deepEqual(log, []);
  const outputs = (model.inputs[1] as { type?: string; output?: string }[]).filter(item => item.type === 'function_call_output');
  assert.match(outputs[0].output!, /^ERROR: .*INVALID_JSON/);
  assert.match(outputs[1].output!, /Todavía no está hecha/);
  assert.ok(events.some(event => event.type === 'proposal'));
});

test('con OpenAI, un rechazo o el filtro de contenido detienen el turno y una llamada truncada no corre', async () => {
  for (const script of [{ events: [{ type: 'response.refusal.delta', delta: 'No puedo' }], output: [] }, { output: [], status: 'incomplete', reason: 'content_filter' }]) {
    const events: AgentEvent[] = [];
    await runAgentLoop({ driver: openaiDriver({ createStream: fakeOpenAI([script]).createStream as never, input: [] }), tools: [], emit: event => events.push(event) });
    assert.equal((events[0] as { code: string }).code, 'REFUSAL');
  }
  const log: string[] = [], events: AgentEvent[] = [];
  await runAgentLoop({ driver: openaiDriver({ createStream: fakeOpenAI([{ output: [call('c1', 'buscar_polizas', '{}')], status: 'incomplete', reason: 'max_output_tokens' }]).createStream as never, input: [] }), tools: fakeTools(log), emit: event => events.push(event) });
  assert.equal((events[0] as { code: string }).code, 'TRUNCATED');
  assert.deepEqual(log, []);
});
