// OpenAI (Responses API, streaming) as a ModelDriver. Follows OpenAI's function-calling guide: the model's output
// items (reasoning included, encrypted because requests use store: false) go back into the input before the
// function_call_output items, arguments arrive as a JSON string to parse, and a refusal or a content-filter stop
// ends the turn. Free of server-only code so tests/agents.test.ts can drive it with a scripted stream.
import { toResponseInputItems } from 'openai/lib/responses/ResponseInputItems';
import type { Response, ResponseInputItem, ResponseStreamEvent } from 'openai/resources/responses/responses';
import type { ModelDriver, ToolCall, ToolOutcome, TurnResult } from '../loop';
export type OpenAIStream = AsyncIterable<ResponseStreamEvent> & { finalResponse(): Promise<Response> };
export function openaiDriver({ createStream, input }: { createStream: (input: ResponseInputItem[]) => OpenAIStream; input: ResponseInputItem[] }): ModelDriver {
  return {
    async next(onText): Promise<TurnResult> {
      const stream = createStream(input);
      let refused = false;
      for await (const event of stream) {
        if (event.type === 'response.output_text.delta') onText(event.delta);
        else if (event.type === 'response.refusal.delta') refused = true;
      }
      const response = await stream.finalResponse();
      const usage = { input: response.usage?.input_tokens ?? 0, output: response.usage?.output_tokens ?? 0, cacheRead: response.usage?.input_tokens_details?.cached_tokens ?? 0 };
      const refusalPart = response.output.some(item => item.type === 'message' && item.content.some(part => part.type === 'refusal'));
      if (refused || refusalPart || response.incomplete_details?.reason === 'content_filter') return { calls: [], stop: 'refusal', usage };
      const calls: ToolCall[] = response.output.flatMap(item => {
        if (item.type !== 'function_call') return [];
        try { return [{ id: item.call_id, name: item.name, input: JSON.parse(item.arguments) as unknown }]; }
        catch { return [{ id: item.call_id, name: item.name, input: item.arguments, invalid: true }]; }
      });
      if (!calls.length) return { calls: [], stop: 'end', usage };
      if (response.status === 'incomplete') return { calls: [], stop: 'truncated', usage };
      input.push(...toResponseInputItems(response.output));
      return { calls, stop: 'tools', usage };
    },
    pushResults(results: ToolOutcome[]) {
      // The Responses API has no error flag on function output: an error travels as its text.
      input.push(...results.map((result): ResponseInputItem => ({ type: 'function_call_output', call_id: result.id, output: result.isError ? `ERROR: ${result.content}` : result.content })));
    },
  };
}
