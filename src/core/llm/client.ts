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
  // Mutable session model (V5/02): the single source of truth for which model turns go to. Set at boot
  // from the models Ollama actually has installed (resolve-boot-model.ts) and changed live by
  // `/models use`. Every consumer — phase turns, spawned Worker/Reviewer/Retro windows, sub-agents,
  // oneShot — reads it through this one client, so they all follow the live model together (the model
  // only ever changes between turns, never mid-work).
  //
  // `undefined` is a real, reachable state, not a placeholder: a machine with no models installed where
  // the user declined the boot download still gets a working REPL (to run `/models pull`), it just cannot
  // take a turn yet. Every path that needs a name for real goes through requireModel().
  private modelName: string | undefined;
  private readonly numCtx: number;
  private lastTokens: TokenCounts = NO_TOKENS;

  constructor(opts: { modelName: string | undefined; numCtx: number }) {
    this.modelName = opts.modelName;
    this.numCtx = opts.numCtx;
    this.ollama = new Ollama();
  }

  /**
   * The live session model, or undefined when none is selected — read by the status line, which renders
   * the empty case rather than pretending. Callers that need a name to actually CALL Ollama use
   * requireModel() instead.
   */
  get model(): string | undefined {
    return this.modelName;
  }

  /**
   * The live session model, or a clear, actionable throw when there is none. The REPL catches it and
   * prints it as one recoverable line, so a model-less session answers "why did nothing happen?" at the
   * moment the user tries — instead of sending `model: undefined` to Ollama and surfacing its 404.
   */
  requireModel(): string {
    if (this.modelName === undefined) {
      throw new Error(
        `No model selected. Pull one with  /models pull <name>  (or  /models use <name>  if it's already installed).`,
      );
    }
    return this.modelName;
  }

  /** Switch the live session model (V5/02 `/models use`); the next chat/stream call uses it. */
  setModel(name: string): void {
    this.modelName = name;
  }

  /** Exact token counts from the most recent completed call (chat or stream). */
  get lastTurnTokens(): TokenCounts {
    return this.lastTokens;
  }

  /** Non-streaming turn. Ports provider.chat() + orchestrator's tool-call recovery. */
  async chat(messages: Message[], tools?: Tool[]): Promise<ChatResult> {
    const response = await this.ollama.chat({
      // requireModel throws a "no model selected, pull one" line if the session has none (see the field).
      model: this.requireModel(),
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
    // Resolved HERE, not inside the generator: an async generator's body doesn't run until its first
    // next(), so a throw from within would surface only once a caller started consuming deltas — long
    // after the turn looked like it had started. requireModel throws a "no model selected, pull one"
    // line if the session has none (see the field), and this way it lands on the stream() call itself.
    const model = this.requireModel();

    const run = async function* (this: OllamaClient): AsyncGenerator<string, void, unknown> {
      const filter = new StreamFilter();
      let rawContent = '';
      const toolCalls: ToolCall[] = [];
      let tokens: TokenCounts = NO_TOKENS;

      const iterator = await this.ollama.chat({
        model,
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
