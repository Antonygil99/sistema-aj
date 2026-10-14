// Claude (Messages API, streaming) as a ModelDriver. Per the Claude API guidance for a streaming manual loop:
// the assistant turn goes back verbatim (thinking blocks included), all tool results return in one user message,
// a refusal or a tool call cut off at max_tokens stops the turn, pause_turn resumes, and only a tool input the SDK
// could not parse at all is re-issued (API errors and aborts go to the caller).
import Anthropic from '@anthropic-ai/sdk';
import type { BetaMessage, BetaMessageParam, BetaToolResultBlockParam, BetaToolUseBlock } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import type { ModelDriver, ToolOutcome, TurnResult } from '../loop';
export type AnthropicStream = { on(event: 'text', listener: (delta: string) => void): unknown; finalMessage(): Promise<BetaMessage> };
const MAX_JSON_RETRIES = 2;
export function anthropicDriver({ createStream, messages }: { createStream: (messages: BetaMessageParam[]) => AnthropicStream; messages: BetaMessageParam[] }): ModelDriver {
  return {
    async next(onText): Promise<TurnResult> {
      for (let attempt = 0; ; attempt++) {
        const stream = createStream(messages);
        stream.on('text', onText);
        let message: BetaMessage;
        try { message = await stream.finalMessage(); }
        catch (error) {
          if (error instanceof Anthropic.APIError || (error as Error)?.name === 'AbortError' || attempt >= MAX_JSON_RETRIES) throw error;
          continue;
        }
        const usage = { input: message.usage.input_tokens, output: message.usage.output_tokens, cacheRead: message.usage.cache_read_input_tokens ?? 0 };
        const calls = message.content.filter((block): block is BetaToolUseBlock => block.type === 'tool_use');
        if (message.stop_reason === 'refusal') return { calls: [], stop: 'refusal', usage };
        if (message.stop_reason === 'pause_turn') { messages.push({ role: 'assistant', content: message.content }); return { calls: [], stop: 'continue', usage }; }
        if (!calls.length) return { calls: [], stop: 'end', usage };
        if (message.stop_reason === 'max_tokens') return { calls: [], stop: 'truncated', usage };
        messages.push({ role: 'assistant', content: message.content });
        return { calls: calls.map(call => ({ id: call.id, name: call.name, input: call.input })), stop: 'tools', usage };
      }
    },
    pushResults(results: ToolOutcome[]) {
      messages.push({ role: 'user', content: results.map((result): BetaToolResultBlockParam => ({ type: 'tool_result', tool_use_id: result.id, content: result.content, ...(result.isError ? { is_error: true } : {}) })) });
    },
  };
}
