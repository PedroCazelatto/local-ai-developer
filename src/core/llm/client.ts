// OllamaClient — the orchestrator's only link to the single local model. Wraps the `ollama`
// npm package with chat + stream + tool-calling, passes num_ctx (the hard VRAM ceiling), and
// captures EXACT token counts from prompt_eval_count / eval_count. Port of core/llm/provider.py
// plus the token-capture from orchestrator._update_token_counts and the StreamFilter wiring
// from orchestrator._stream.

import { Ollama } from 'ollama';
import type { ChatResponse, Message, Tool, ToolCall } from 'ollama';

import { beginModelCall } from './begin-model-call.js';
import type { ModelCallLifetime } from './begin-model-call.type.js';
import { ollamaWithSignal } from './ollama-with-signal.js';
import { StreamFilter } from './stream-filter.js';
import { recoverToolCalls } from './tool-call-recovery.js';
import { TurnAbortedError } from './turn-aborted-error.js';
import type { ChatResult, TokenCounts } from './types.js';

const NO_TOKENS: TokenCounts = { promptTokens: null, evalTokens: null };

/** A live streaming turn: consume `deltas` fully, then read `result()`. */
export interface StreamHandle {
  /** Filtered, human-visible prose deltas (tool-call mechanics stripped). */
  readonly deltas: AsyncIterable<string>;
  /**
   * The turn's message + exact tokens, valid once `deltas` has ENDED — whether it ran to completion or
   * threw a TurnAbortedError. A cancelled turn therefore still yields what the model had produced, which
   * is what lets the orchestrator keep the partial turn on disk (hidden from the window) rather than lose
   * it. Its tokens are null/null: Ollama reports counts only on the final chunk, which an aborted stream
   * never receives, and a count that did not arrive is surfaced as absent, never estimated.
   */
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
  /** Stall window for a single call, from OLLAMA_TIMEOUT_MS — see begin-model-call.ts for the shape. */
  private readonly timeoutMs: number;
  // The lifetime of the request currently in flight, or null between calls. ONE at a time is guaranteed
  // by the product itself, not assumed here: windows are strictly sequential (no parallelism —
  // docs/product.md), a sub-agent runs inside its parent's tool call, and every one-shot is awaited where
  // it is issued. That is why a single field can serve every window through one shared client: whatever
  // is generating right now is what Ctrl+C stops, with no need to name it.
  private inFlight: ModelCallLifetime | null = null;
  // A cancel that arrived with NO call in flight, armed for the next one. This is not an edge case: a
  // turn spends much of its time inside tool calls — an `npm test` in the container can run for minutes
  // — and a Ctrl+C there means "stop this turn" just as plainly as one during generation. Without this
  // the key would find nothing to cancel and fall through to ending the session, which is the single
  // most surprising thing it could do at that moment.
  private cancelPending = false;

  constructor(opts: { modelName: string | undefined; numCtx: number; timeoutMs: number }) {
    this.modelName = opts.modelName;
    this.numCtx = opts.numCtx;
    this.timeoutMs = opts.timeoutMs;
    this.ollama = new Ollama();
  }

  /**
   * Cancel whatever model call is in flight (Ctrl+C during a turn). Returns false when there was nothing
   * generating — which is what lets the key fall through to its old meaning instead of swallowing a
   * press that would otherwise have ended the session.
   *
   * Safe to call from a keypress handler: it only trips an AbortController, and the request's own path
   * turns that into a TurnAbortedError where the turn is actually being awaited.
   */
  cancel(): boolean {
    if (this.inFlight !== null) {
      // Already aborting: this is the SECOND press, so decline it and let the key mean what it used to.
      if (this.inFlight.abortReason() !== null) return false;
      this.inFlight.cancel();
      return true;
    }
    if (this.cancelPending) return false; // armed by an earlier press — again, the second one quits
    this.cancelPending = true;
    return true;
  }

  /**
   * Drop a cancel that was armed but never consumed — e.g. the turn ended inside the tool call the user
   * pressed Ctrl+C during, so no further model call ever ran. The REPL calls this once an input line is
   * finished, so an unused arming can never reach into a later, unrelated turn.
   */
  clearPendingCancel(): void {
    this.cancelPending = false;
  }

  /**
   * Consume an armed cancel at the top of a call. Returns the lifetime already aborted, so both paths can
   * take their normal course — open, fail, throw TurnAbortedError — instead of each growing a second,
   * differently-shaped early exit.
   */
  private openCall(): ModelCallLifetime {
    const call = beginModelCall(this.timeoutMs);
    if (this.cancelPending) {
      this.cancelPending = false;
      call.cancel();
    }
    return call;
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

  /**
   * Non-streaming turn. Ports provider.chat() + orchestrator's tool-call recovery.
   *
   * The whole response arrives at once, so there is nothing to touch() and the call's stall window acts
   * as a total timeout — the only thing measurable on this path. ollamaWithSignal is what makes the
   * abort reach the request at all: the package gives a `stream: false` call no signal of its own.
   */
  async chat(messages: Message[], tools?: Tool[]): Promise<ChatResult> {
    // requireModel throws a "no model selected, pull one" line if the session has none (see the field).
    const model = this.requireModel();
    const call = this.openCall();
    this.inFlight = call;
    try {
      const response = await ollamaWithSignal(call.signal).chat({
        model,
        messages,
        tools,
        stream: false,
        options: { num_ctx: this.numCtx },
      });
      return { message: recoverIfNeeded(response.message), tokens: this.captureTokens(response) };
    } catch (err) {
      // An abort surfaces here as a rejected fetch; abortReason disambiguates it from a real fault the
      // same way ollama-models.ts uses signal.aborted for a cancelled pull.
      throw this.abortedOr(call, err);
    } finally {
      call.settle();
      this.inFlight = null;
    }
  }

  /**
   * Rethrow an aborted call as the one typed error every caller checks for, and anything else untouched.
   * A genuine Ollama/network failure must never be dressed up as a cancellation — the REPL keeps the
   * session alive for one and reports the other.
   */
  private abortedOr(call: ModelCallLifetime, err: unknown): unknown {
    const reason = call.abortReason();
    return reason === null ? err : new TurnAbortedError(reason, this.timeoutMs);
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
    // Opened here for the same reason, and published as in-flight immediately: between this call and the
    // consumer's first next() the turn is already "running" as far as the user can see, and a Ctrl+C in
    // that window must cancel it rather than fall through and end the session. The generator's finally
    // is what takes it back down.
    const call = this.openCall();
    this.inFlight = call;

    const run = async function* (this: OllamaClient): AsyncGenerator<string, void, unknown> {
      const filter = new StreamFilter();
      let rawContent = '';
      const toolCalls: ToolCall[] = [];
      let tokens: TokenCounts = NO_TOKENS;

      // Assemble whatever the model produced. Called on BOTH exits — a completed stream and an aborted
      // one — so `result()` is readable either way and a cancelled turn is never a hole. Raw content (for
      // memory replay) + structured tool_calls (for dispatch): the filtered text was for display only, so
      // keep the two channels separate. If Ollama didn't lift any structured calls, recover ones the
      // model wrote as text (bare JSON / <tool_call> tags).
      const capture = (): void => {
        finalResult = {
          message: recoverIfNeeded({
            role: 'assistant',
            content: rawContent,
            ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
          }),
          tokens,
        };
      };

      try {
        // A cancel armed during the previous tool call is already on the lifetime — bail before the
        // request is even sent, so a turn the user stopped costs no generation at all.
        if (call.signal.aborted) throw this.abortedOr(call, new Error('cancelled before the call opened'));
        const iterator = await this.ollama.chat({
          model,
          messages,
          tools,
          stream: true,
          options: { num_ctx: this.numCtx },
        });
        // The `ollama` package exposes no per-request signal param for chat, so bridge the lifetime onto
        // the iterator's own abort() — the same bridge ollama-models.ts builds for a cancelled pull. The
        // pre-check covers a cancel that landed between opening the lifetime and the request opening.
        if (call.signal.aborted) iterator.abort();
        const onAbort = (): void => iterator.abort();
        call.signal.addEventListener('abort', onAbort, { once: true });

        try {
          for await (const chunk of iterator) {
            // Bytes arrived: restart the stall window. This is what keeps a slow-but-alive model — the
            // normal case on a 3060 — from ever tripping a timeout meant for a wedged daemon.
            call.touch();
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
        } finally {
          call.signal.removeEventListener('abort', onAbort);
        }

        const tail = filter.flush();
        if (tail) yield tail;
        capture();
      } catch (err) {
        // A cancelled turn keeps what it had produced — tokens stay null/null, because Ollama reports
        // counts only on the final chunk and an aborted stream never receives one (never estimated).
        capture();
        throw this.abortedOr(call, err);
      } finally {
        call.settle();
        this.inFlight = null;
      }
    };

    const deltas = run.call(this);
    return {
      deltas,
      result(): ChatResult {
        if (finalResult === null) {
          throw new Error(
            'stream result is unavailable until the deltas iterator has ended',
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
