// OllamaClient — the orchestrator's only link to the single local model. Wraps the `ollama`
// npm package with chat + stream + tool-calling, passes num_ctx (the hard VRAM ceiling), and
// captures EXACT token counts from prompt_eval_count / eval_count. Port of core/llm/provider.py
// plus the token-capture from orchestrator._update_token_counts and the StreamFilter wiring
// from orchestrator._stream.

import { Ollama } from 'ollama';
import type { ChatResponse, Message, Tool, ToolCall } from 'ollama';

import { beginModelCall } from './begin-model-call.js';
import type { ModelCallLifetime } from './begin-model-call.js';
import type { CallRole } from './call-role.type.js';
import { exactCount } from './exact-count.js';
import { ollamaWithSignal } from './ollama-with-signal.js';
import { recoverIfNeeded } from './recover-if-needed.js';
import { resolveWindowCtx } from './resolve-window-ctx.js';
import { StreamFilter } from './stream-filter.js';
import type { TokenCounts } from './token-counts.type.js';
import { TurnAbortedError } from './turn-aborted-error.js';
import type { WindowRole } from './window-role.type.js';

const NO_TOKENS: TokenCounts = { promptTokens: null, evalTokens: null };

/**
 * One finished model call: the assistant message Ollama returned, and the EXACT token counts it
 * reported for it. Declared here rather than in a module of its own because OllamaClient owns it —
 * `chat` returns it, `StreamHandle.result()` returns it, and nothing outside core/llm names it.
 */
export interface ChatResult {
  readonly message: Message; // final assistant message, incl. content AND tool_calls
  readonly tokens: TokenCounts;
}

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
  /**
   * The BASE token ceiling — the one WINDOW calls are sent under (OLLAMA_NUM_CTX). PUBLIC and
   * `readonly`: this client is what actually puts `num_ctx` on the wire, so it is the one place the value
   * cannot drift from what Ollama was told, and a window deciding whether its prompt is nearing the
   * ceiling asks the thing that set it rather than having the number threaded through three interfaces.
   *
   * "Base", not simply "the" ceiling, because it is about to stop being the only one: per-window
   * `num_ctx` gives bounded one-shot roles (the context titler, rules search, the commit-message writer)
   * a smaller ceiling of their own. Every WINDOW role — the interactive phases, the Worker, the Reviewer,
   * Retro, sub-agents — stays on this value, which is why a window may safely compare its own
   * prompt_eval_count against it.
   *
   * It must NOT be read as "the ceiling this particular call used". Once a second lane exists, only the
   * call site knows which role it played; this field answers the base, and nothing else.
   */
  readonly baseNumCtx: number;
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
    this.baseNumCtx = opts.numCtx;
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
   *
   * The line says TOOL SUPPORT and names no model (OPEN-QUESTIONS.md #8). A session gets here with no
   * model for two reasons — an empty machine, or a machine whose every model failed the `tools` gate —
   * and this throw cannot tell them apart. config.SUGGESTED_MODEL is a suggestion for the EMPTY case
   * and has not itself been verified tool-capable, so naming it would answer a capability problem with
   * an unverified model and move the problem one pull further along.
   */
  requireModel(): string {
    if (this.modelName === undefined) {
      throw new Error(
        `No model selected. Pull one with tool support:  /models pull <name>  (or  /models use <name>  if it's already installed).`,
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
   *
   * `role` comes FIRST and is required, because it is what decides the ceiling this call is sent under
   * and there is no sensible default for it — a call that could omit it would be a call whose ceiling
   * nobody chose. It takes the full CallRole: this is the one method both a window (a sub-agent) and a
   * one-shot reach.
   */
  async chat(role: CallRole, messages: Message[], tools?: Tool[]): Promise<ChatResult> {
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
        // resolveWindowCtx: this role's ceiling — baseNumCtx for every window role and for the one-shots
        // whose input is window-sized, a smaller one for the bounded one-shots. The ONLY place a ceiling
        // is chosen; see resolve-window-ctx.ts for why the base is structurally exact.
        options: { num_ctx: resolveWindowCtx(role, this.baseNumCtx) },
      });
      // recoverIfNeeded folds in any tool call the model wrote as text when Ollama lifted none itself.
      return { message: recoverIfNeeded(response.message), tokens: this.captureTokens(response) };
    } catch (err) {
      // An abort surfaces here as a rejected fetch; abortReason disambiguates it from a real fault the
      // same way pull-model.ts uses signal.aborted for a cancelled pull.
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
   *
   * `role` is a WindowRole, not the full CallRole: streaming exists to render a reply to the user as it
   * arrives, and a one-shot has no reader — it is awaited whole where it is issued. So the narrower type
   * is the honest one, and it makes "a one-shot streamed to nobody" unrepresentable.
   */
  stream(role: WindowRole, messages: Message[], tools?: Tool[]): StreamHandle {
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
          // Same single resolution point as chat() — a window role, so in practice this is baseNumCtx.
          options: { num_ctx: resolveWindowCtx(role, this.baseNumCtx) },
        });
        // The `ollama` package exposes no per-request signal param for chat, so bridge the lifetime onto
        // the iterator's own abort() — the same bridge pull-model.ts builds for a cancelled pull. The
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
    // exactCount passes a reported number through and turns an absent metric into null, never 0.
    const tokens: TokenCounts = {
      promptTokens: exactCount(response.prompt_eval_count),
      evalTokens: exactCount(response.eval_count),
    };
    this.lastTokens = tokens;
    return tokens;
  }
}
