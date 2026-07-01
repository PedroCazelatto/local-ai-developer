> **Status:** ✅ Completed (2026-06-30)

# 03 — Ollama client (TS)

**Version:** Foundation
**Depends on:** 02 (config provides `modelName` + `numCtx`)
**Blocks:** 06 (the orchestrator turn loop streams through this client)

## Why

The orchestrator's only link to the single local model is the Ollama client. It must stream assistant output, pass `num_ctx`, surface the final structured message **including `tool_calls`**, and report **exact** token counts from `prompt_eval_count` / `eval_count` — never an estimate (CLAUDE.md "Token counts are always exact"). This is the direct TS port of `core/llm/provider.py` plus the token-capture logic that lived in `orchestrator._update_token_counts`, plus the `StreamFilter` that strips tool-call mechanics from visible prose (`core/llm/stream_filter.py`).

## Behavior

A `OllamaClient` class in `src/core/llm/` wrapping the `ollama` npm package. It is constructed with `{ modelName, numCtx }` (from `SessionConfig`).

### Signatures

```ts
import type { Message, Tool, ToolCall } from 'ollama';

export interface TokenCounts {
  promptTokens: number | null;   // exact prompt_eval_count; null if Ollama omitted it
  evalTokens: number | null;     // exact eval_count; null if omitted
}

export interface ChatResult {
  message: Message;              // final assistant message, incl. content AND tool_calls
  tokens: TokenCounts;
}

export class OllamaClient {
  constructor(opts: { modelName: string; numCtx: number });

  // Non-streaming — ports provider.chat()
  chat(messages: Message[], tools?: Tool[]): Promise<ChatResult>;

  // Streaming — ports provider.stream(); yields VISIBLE prose deltas only
  // (tool-call mechanics filtered out). Final structured message + tokens
  // are exposed via the returned handle after the iterator is exhausted.
  stream(messages: Message[], tools?: Tool[]): {
    deltas: AsyncIterable<string>;     // filtered, human-visible text
    result(): ChatResult;             // valid only after deltas are fully consumed
  };
}
```

(The exact handle shape is flexible — an async generator that also stashes a `lastResult`, or a small object as above. The hard requirements are below.)

### num_ctx

Every call passes `options: { num_ctx: this.numCtx }` (ports `provider.py` `options={"num_ctx": self.num_ctx}`). This is the hard token ceiling; do not omit it.

### Exact token capture

- On the **non-streaming** path: read `response.prompt_eval_count` and `response.eval_count` directly off the Ollama response.
- On the **streaming** path: the counts arrive on the **final chunk** (the one with `done: true`). Ollama emits them only there — read them from that chunk, exactly as `orchestrator._stream` did (`if chunk.get("done"): self._update_token_counts(chunk)`).
- Store them as `promptTokens` / `evalTokens`. Expose a `lastTurnTokens` getter and/or return them in `ChatResult`.
- **Missing metric → `null`, surfaced explicitly.** If Ollama omits a count, the field is `null`; never substitute a length-based estimate, and never coerce `null` to `0` silently (the orchestrator/UI decides how to display "unknown"). The old Python code did `prompt_eval_count or 0` — **do not** copy that coercion; preserve the distinction between "0 tokens" and "not reported".

### Streamed deltas + StreamFilter port

Ollama streams `ChatResponse` chunks; `chunk.message.content` carries the incremental text. While streaming:

1. **Collect tool_calls from every chunk**, not just the last. Ollama emits structured `tool_calls` on intermediate `done:false` chunks for some models — accumulate them across all chunks (ports `orchestrator._stream`: `tool_calls.extend(msg["tool_calls"])` inside the loop).
2. **Filter visible prose** through a `StreamFilter` (port of `core/llm/stream_filter.py`) so the REPL shows clean text, not tool-call JSON. The filter is a small state machine that suppresses three shapes the model sometimes emits as plain text instead of structured calls:
   - `<tool_call> ... </tool_call>` tag-wrapped blocks.
   - Bare top-level JSON objects whose keys include `name`, `function_name`, or `tool` (qwen2.5-coder bare-emission).
   - The same JSON wrapped in a ```json … ``` fence (fence included).
   It holds balanced-but-not-tool-call JSON / fenced JSON and emits it in one chunk once it proves harmless; a `flush()` at end-of-stream returns held prose and drops partial tool-call buffers. Port the brace-depth/in-string/escape tracking and the prose / tag / json / fence_open / fence_body / fence_json / fence_close modes from the Python file. **Only the visible (filtered) text is yielded** to the caller; the structured `message.tool_calls` is unaffected by filtering.
3. **Assemble the final message** after the stream ends: `{ role: 'assistant', content: <full raw content>, tool_calls: <accumulated or null> }`. Note `content` here is the **raw** accumulated content (the orchestrator needs it for memory); the *filtered* text is only for display. Keep both: raw → `ChatResult.message.content`; filtered → the yielded deltas.

> Note: the Python code also had a `recover_tool_calls` fallback (parse tool calls out of `content` when Ollama emitted none structurally). That belongs to the tool-dispatch wiring (V1) — you may stub a `recoverToolCalls(content)` seam here but it is **not** required for Foundation. Capturing structured `tool_calls` from chunks is required.

## Files

- `src/core/llm/client.ts` — `OllamaClient` (`chat`, `stream`, token capture, `num_ctx`).
- `src/core/llm/stream-filter.ts` — `StreamFilter` state machine port (push/flush, prose-only output).
- `src/core/llm/types.ts` — `TokenCounts`, `ChatResult` (re-export `Message`/`Tool`/`ToolCall` from `ollama` rather than redefining them).

## Notes / pitfalls

- **Exact tokens or `null` — never an estimate, never silent `0`.** This is the single most-violated rule; the whole VRAM-safety model depends on it. Read from the `done:true` chunk on streaming; if absent, `null`.
- The `ollama` npm package's `chat({ stream: true })` returns an `AsyncGenerator<ChatResponse>`; `chat({ stream: false })` returns a `ChatResponse`. Branch on the `stream` flag and type accordingly — do not reach for `any` to bridge the two return types (use the package's overloads / `Tool`, `Message`, `ChatResponse` types).
- Filter affects **display only**. The orchestrator's memory must store the raw assistant `content` and the structured `tool_calls`, not the filtered text. Keep the two channels separate or 06 will replay corrupted history.
- qwen2.5-coder's chat template renders assistant `content` **or** `tool_calls` (if/else) — this matters in 06 (drop content when storing a tool-call turn), not here, but the client must expose both so 06 can decide.
- Don't block the event loop: stream consumption is `for await … of`.

## Acceptance

- A scripted live check (per the user's "verify via scripted live checks" memory) constructs `OllamaClient` against the running local Ollama, sends a one-message conversation, consumes the `deltas` iterator, and prints the streamed text plus `result().tokens` — and `promptTokens`/`evalTokens` are **real integers from the model**, matching what `ollama` reports (not 0, not estimated).
- Asking the model a question whose answer it would normally wrap in a ```json fence shows clean prose in the streamed deltas, with the fenced tool-call-shaped JSON suppressed — while `result().message.tool_calls` (if the model emitted a structured call) is still populated.
- Forcing/observing a turn where Ollama omits a token count yields `null` for that field (verifiable in the script output), not `0`.
- `num_ctx` from `SessionConfig` is honored: setting `OLLAMA_NUM_CTX` small and sending an over-long history shows Ollama truncating (no crash from the client side).
