// OllamaClient — the orchestrator's only link to the single local model. Wraps the `ollama`
// npm package with chat + stream + tool-calling, passes num_ctx (the hard VRAM ceiling), and
// captures EXACT token counts from prompt_eval_count / eval_count. Port of core/llm/provider.py
// plus the token-capture from orchestrator._update_token_counts and the StreamFilter wiring
// from orchestrator._stream.

import { Ollama } from 'ollama';
import type { ChatResponse, Message, Tool, ToolCall } from 'ollama';

import { StreamFilter } from './stream-filter.js';
import { recoverToolCalls } from './tool-call-recovery.js';
import type { ChatResult, TokenCounts } from './types.js';

const NO_TOKENS: TokenCounts = { promptTokens: null, evalTokens: null };

/** A live streaming turn: consume `deltas` fully, then read `result()`. */
export interface StreamHandle {
  /** Filtered, human-visible prose deltas (tool-call mechanics stripped). */
  readonly deltas: AsyncIterable<string>;
  /** Final message + exact tokens. Valid only after `deltas` is fully consumed. */
  result(): ChatResult;
}

export class OllamaClient {
  private readonly ollama: Ollama;
  private readonly modelName: string;
  private readonly numCtx: number;
  private lastTokens: TokenCounts = NO_TOKENS;

  constructor(opts: { modelName: string; numCtx: number }) {
    this.modelName = opts.modelName;
    this.numCtx = opts.numCtx;
    this.ollama = new Ollama();
  }

  /** Exact token counts from the most recent completed call (chat or stream). */
  get lastTurnTokens(): TokenCounts {
    return this.lastTokens;
  }

  /** Non-streaming turn. Ports provider.chat() + orchestrator's tool-call recovery. */
  async chat(messages: Message[], tools?: Tool[]): Promise<ChatResult> {
    const response = await this.ollama.chat({
      model: this.modelName,
      messages,
      tools,
      stream: false,
      options: { num_ctx: this.numCtx },
    });
    return { message: recoverIfNeeded(response.message), tokens: this.captureTokens(response) };
  }

  /**
   * Streaming turn. Ports provider.stream() + orchestrator._stream. Yields only VISIBLE
   * (filtered) prose; the raw content and structured tool_calls are assembled into the final
   * message exposed via `result()` after the iterator is exhausted.
   */
  stream(messages: Message[], tools?: Tool[]): StreamHandle {
    let finalResult: ChatResult | null = null;

    const run = async function* (this: OllamaClient): AsyncGenerator<string, void, unknown> {
      const filter = new StreamFilter();
      let rawContent = '';
      const toolCalls: ToolCall[] = [];
      let tokens: TokenCounts = NO_TOKENS;

      const iterator = await this.ollama.chat({
        model: this.modelName,
        messages,
        tools,
        stream: true,
        options: { num_ctx: this.numCtx },
      });

      for await (const chunk of iterator) {
        const delta = chunk.message.content;
        if (delta) {
          rawContent += delta;
          const visible = filter.push(delta);
          if (visible) yield visible;
        }
        // Ollama emits structured tool_calls on intermediate chunks (done:false) for some
        // models, not just the final one — accumulate from every chunk.
        const chunkCalls = chunk.message.tool_calls;
        if (chunkCalls && chunkCalls.length > 0) {
          toolCalls.push(...chunkCalls);
        }
        if (chunk.done) {
          tokens = this.captureTokens(chunk);
        }
      }

      const tail = filter.flush();
      if (tail) yield tail;

      // Raw content (for memory replay) + structured tool_calls (for dispatch). The filtered
      // text was for display only; keep the two channels separate. If Ollama didn't lift any
      // structured calls, recover ones the model wrote as text (bare JSON / <tool_call> tags).
      const message = recoverIfNeeded({
        role: 'assistant',
        content: rawContent,
        ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
      });
      finalResult = { message, tokens };
    };

    const deltas = run.call(this);
    return {
      deltas,
      result(): ChatResult {
        if (finalResult === null) {
          throw new Error(
            'stream result is unavailable until the deltas iterator is fully consumed',
          );
        }
        return finalResult;
      },
    };
  }

  /**
   * Read EXACT counts off an Ollama response/chunk. Missing metric → null (never a
   * length-based estimate, never a silent 0). Preserves "0 tokens" vs "not reported".
   */
  private captureTokens(response: ChatResponse): TokenCounts {
    const tokens: TokenCounts = {
      promptTokens: exactCount(response.prompt_eval_count),
      evalTokens: exactCount(response.eval_count),
    };
    this.lastTokens = tokens;
    return tokens;
  }
}

function exactCount(value: number | undefined | null): number | null {
  return typeof value === 'number' ? value : null;
}

/**
 * When Ollama returned no structured tool_calls, recover any the model wrote as text and fold
 * them into the message (with the call text stripped from `content`). A no-op when the message
 * already has structured calls or the content holds none.
 */
function recoverIfNeeded(message: Message): Message {
  if (message.tool_calls && message.tool_calls.length > 0) return message;
  const { cleaned, calls } = recoverToolCalls(message.content);
  if (calls.length === 0) return message;
  return { ...message, content: cleaned, tool_calls: calls };
}
