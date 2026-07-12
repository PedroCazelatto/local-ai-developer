> **Status:** ✅ Completed (2026-07-11) — `core/session/summarizer.ts` (`compactActivePhase`) collapses the active phase's oldest ~50% of *visible* turns into one appended `summary` record via the shared `oneShot` throwaway call (V4/02) — never in session history. Selection extends past a leading `tool` result so the surviving view never begins with an orphan tool call. The orchestrator captures each phase's EXACT `prompt_eval_count` in `onTokens` and schedules a compaction (`scheduledPhases`) once it reaches `SUMMARIZATION_THRESHOLD_RATIO × num_ctx`; a new optional `TurnContext.beforeModelCall` hook (awaited by the turn loop before every call, absent on spawned windows) runs it synchronously and prints `Compacting <Phase> history (failsafe)...`. Append-only: `SessionMemory.appendSummary` writes the `summary` row (role `summary`, `replaces` = collapsed ids, `tokens` = the throwaway call's exact counts) to `<phase>.jsonl`; the shared `visibleRecords` walk (extracted in `memory-store.ts`, reused by `recordsToMessages`) drops the replaced turns so a restart reproduces the identical compacted view. Config: `SUMMARIZATION_THRESHOLD_RATIO` (default 0.75, validated to (0, 1]) in `.env.example` + `config.ts`. Verified deterministically (stubbed client): selection + tool-guard, exact tokens, 8→9 append-only lines, reload determinism, ratio resolver. Not exercised: the live trigger loop (needs Ollama + Docker) — straightforward wiring on top of the verified compaction.

# 05 — Token-threshold summarization failsafe

**Version:** V4
**Depends on:** V4/04 (per-phase JSONL persistence + the load-time `replaces` skip walk), V4/02 (the shared `oneShot` throwaway-Ollama helper), Foundation/03 (exact `prompt_eval_count`).
**Blocks:** V4 exit criterion (a long history compacts via the failsafe, next `prompt_eval_count` drops sharply).

## Why

CLAUDE.md ("Memory model") defines summarization as a **failsafe, not normal operation**: when a phase's history crosses a configured token threshold, the orchestrator summarizes the oldest turns into a single `summary` record. It is a safety valve against VRAM exhaustion on the RTX 3060 (`num_ctx` is a hard ceiling — exceed it and Ollama silently drops the oldest tokens), not routine compaction.

## Behavior

### Token accounting — exact, never estimated

The trigger uses Ollama's **actual returned** `prompt_eval_count` for the most recent call on that phase. Never approximate from string length, JSON length, or character counts — a length-based token heuristic is forbidden anywhere in this repo (CLAUDE.md "Memory model"; ROADMAP sequencing principle 4).

Flow:

1. Every model call already returns `prompt_eval_count`. Capture the exact value on the active phase's state: `lastPromptTokens[phase] = prompt_eval_count`.
2. The threshold check reads that exact number — never a recomputed estimate.

### Trigger

After each model call (so the real `prompt_eval_count` just used is known):

```
threshold = SUMMARIZATION_THRESHOLD_RATIO * num_ctx
if lastPromptTokens[phase] >= threshold:
    scheduleSummarizationForNextCall(phase)
```

- `SUMMARIZATION_THRESHOLD_RATIO` default **0.75**, read from `.env` (alongside `OLLAMA_NUM_CTX`). `num_ctx` is the active `OLLAMA_NUM_CTX`. 0.75 leaves headroom for the next response and any tool-result payloads.
- The summarization runs **before the next model call for that phase**, **synchronously** in the orchestrator's main loop (no background thread — no parallelism). The user sees one status line: `Compacting <Phase> history (failsafe)...`.

### What gets summarized

Take the **oldest ~50%** of the phase's *currently-visible* turns (configurable later) and replace them with one synthetic `summary` record appended to `<phase>.jsonl`:

```json
{
  "id": "01HG...",
  "ts": "2026-06-21T20:00:00Z",
  "role": "summary",
  "replaces": ["01HF...a", "01HF...b", "01HF...c"],
  "content": "Summary of turns ... — Discovery captured Vision + Glossary in PRODUCT_SPEC.md; chose JWT refresh; open: schema decision ...",
  "tokens": { "prompt": 4210, "completion": 384 }
}
```

- `replaces` lists the **ULID of every turn it covers** — an explicit id list, not a range (keeps the loader trivial and survives any reordering).
- Originals **stay in the JSONL** (append-only — never rewrite). Only the **in-memory view** collapses.
- `tokens` on the summary record itself comes from the throwaway summarization call's exact counts (`null` if genuinely absent).

### Summarization call

A **throwaway Ollama call** via the shared `oneShot` helper (V4/02) — a fresh `messages` array, **not** added to any phase's session history, same session model + same `num_ctx`. System prompt should:

- state it is compressing a coding-agent transcript for VRAM reasons;
- instruct it to **preserve concrete artifacts** — file paths, function/type names, decisions made, open items, inbox items raised — over conversational filler;
- instruct it to be terse, targeting a small fraction of the original token count.

### Loader interaction (the read side lives in V4/04)

V4/04's loader already walks `<phase>.jsonl` forward, accumulating a `replacedIds` set from every `summary.replaces` and skipping any record whose `id` is in that set. So a `summary` sits in chronological order at the point it was written; the older turns it replaces are skipped wherever they appear; later turns are untouched. This task only adds the **writing** side (the throwaway call + the appended `summary` record). Confirm the V4/04 walk handles a `summary` correctly; if it doesn't, fix it here.

## Files

- `src/core/session/summarizer.ts` — new; threshold check, oldest-50% selection, the throwaway summarization call (via `oneShot`), and appending the `summary` record (ULID + `replaces`) to `<phase>.jsonl`.
- `src/core/session/orchestrator.ts` — capture `lastPromptTokens[phase]` after each call; run `scheduleSummarizationForNextCall` synchronously before the next call; emit the `Compacting...` status line.
- `.env.example` — add `SUMMARIZATION_THRESHOLD_RATIO=0.75`.
- Config loader (Foundation/02) — read `SUMMARIZATION_THRESHOLD_RATIO` with a 0.75 default.

## Notes / pitfalls

- **Exact tokens only.** The trigger compares the exact `prompt_eval_count` against `ratio * num_ctx`. After implementing, grep the codebase for any `.length`, `/ 3.5`, `/ 4`, or "approx tokens" heuristic — there must be none.
- **Append-only.** The summary is *appended*; originals are never removed from disk. Re-loading after restart must reproduce the identical compacted view.
- **Throwaway = not in history.** The summarization call must not land in the phase's persisted turns (same rule as `search_rules` in V4/02). Reuse `oneShot`.
- **Synchronous, single-threaded.** Runs in the main loop before the next call — no background thread, no parallelism. The user sees the status line and the next turn proceeds on the compacted view.
- **Failsafe, not routine.** This should fire rarely; do not summarize on every turn or below threshold. It exists to keep `prompt_eval_count` under the `num_ctx` ceiling.
- Preserve artifacts: a summary that loses file paths/decisions defeats the purpose — the phase must still know where it stopped.

## Acceptance

- Hand-craft a phase JSONL long enough that the next call's `prompt_eval_count` crosses `0.75 * num_ctx`; activate that phase and send a turn → `Compacting <Phase> history (failsafe)...` appears, a `summary` record is **appended** to the JSONL with a populated `replaces` list, and the **subsequent** call's `prompt_eval_count` drops sharply.
- Restart `run start` and re-activate the phase → the loader reproduces the **same** compacted in-memory view (older replaced turns skipped, summary in place, later turns intact).
- Set `SUMMARIZATION_THRESHOLD_RATIO=0.5` in `.env` → compaction triggers earlier; default (unset) behaves as 0.75.
- The `summary` record's `tokens` come from the throwaway call's exact Ollama counts. Grep confirms no length-based token estimate exists anywhere in the repo.
- The throwaway summarization call does not appear in the phase's persisted history (memory dump shows the `summary` record but not the summarizer's own prompt/response as turns).
