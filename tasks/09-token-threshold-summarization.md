# 09 — Token-threshold summarization failsafe

**Milestone:** M4 — Persistence
**Depends on:** 08 (persistence layer in place).

## Why

CLAUDE.md describes summarization as a *failsafe*, not normal operation: when a persona's history crosses a configured token threshold, the orchestrator summarizes the oldest turns and replaces them with a single summary entry. This is a safety valve against VRAM exhaustion on the user's RTX 3060, not routine compaction.

## Token accounting — exact, not estimated

Per CLAUDE.md's token-accuracy rule: this task **must** use Ollama's actual returned counts (`prompt_eval_count` and `eval_count` from the chat response). Never approximate from string length, JSON length, or character counts.

The flow:

1. Every `stream_ask` already receives `prompt_eval_count` for the call it just made. Capture it on the orchestrator and on the persona's in-memory state.
2. Store the latest exact count alongside the active persona: `memory.last_prompt_tokens[role] = prompt_eval_count`.
3. The threshold check uses that exact number — never a recomputed estimate.

## Trigger

After each model call (so we know the real `prompt_eval_count` that was just used), compare against the threshold:

```
threshold = SUMMARIZATION_THRESHOLD_RATIO * num_ctx
if last_prompt_tokens >= threshold:
    schedule_summarization_for_next_call(role)
```

Defaults: `SUMMARIZATION_THRESHOLD_RATIO = 0.75`, configurable via `.env`. Conservative — leaves headroom for the next response and any tool call payloads.

The summarization runs **before** the next model call for that persona (synchronously, in the orchestrator's main loop), not on a background thread. The user sees a one-line status: `Compacting Developer history (failsafe)...`.

## What gets summarized

Take the **oldest 50%** of turns (proposal — configurable later if needed) and replace them with one synthetic record:

```json
{
  "id": "01HG...",
  "ts": "2026-05-22T20:00:00Z",
  "role": "summary",
  "replaces": ["01HF...a", "01HF...b", "01HF...c", "..."],
  "content": "Summary of turns ... — Explorer captured Vision and Glossary in PRODUCT_SPEC.md ...",
  "tokens": { "prompt": 4210, "completion": 384 }
}
```

The `replaces` field lists the **IDs of every turn it covers**. Explicit list, not a range — makes the loader trivial and survives any future reordering. The original turns stay in the JSONL (append-only); only the in-memory view collapses.

## Summarization prompt

Throwaway Ollama call (not in session memory). System prompt should:

- Tell the model it's compressing a coding-agent transcript for VRAM reasons.
- Tell it to **preserve concrete artifacts** (file paths, function names, decisions made, open items, inbox items raised) over conversational filler.
- Tell it to be terse — target a fraction of the original token count.

Use the same session model and num_ctx as the active session — consistent with the search-rules choice in task 06.

## Loader behavior

When task 08's loader reads `<role>.jsonl`:

1. Walk the file forward, building a list of records.
2. Maintain a set `replaced_ids` initially empty.
3. When a `summary` record appears, add every id in `replaces` to `replaced_ids`.
4. The in-memory history is the full list, **filtered**: any record whose id is in `replaced_ids` is skipped.

This means the summary record appears in chronological order at the point it was written. Earlier turns it replaces are skipped wherever they appear in the file. Later turns are untouched.

## Acceptance

- Hand-craft a persona JSONL whose total `prompt_eval_count`-equivalent crosses the threshold, swap to it, ask a question — see `Compacting...` appear, a `summary` record appended to the JSONL, and the next model call's `prompt_eval_count` drop sharply.
- Re-loading the persona after restart yields the same compacted view.
- A `tokens` field on every record is sourced from Ollama, not estimated. Audit by grepping the code for any `len(...)` or `/ 3.5` style heuristic — there should be none.
