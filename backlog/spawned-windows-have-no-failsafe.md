# The spawned windows have no summarization failsafe

**Category:** Memory / context

`beforeModelCall` — the hook that triggers summarization when a history crosses
`SUMMARIZATION_THRESHOLD_RATIO × num_ctx` — exists **only on `SessionOrchestrator`**. None of
`worker-runner.ts`, `reviewer-runner.ts`, `retro-runner.ts` or `subagents.ts` implements it.

So the three interactive phases have a failsafe and the four spawned windows have none. Past `num_ctx`
Ollama silently drops the oldest tokens of the prompt and returns a perfectly ordinary-looking
response. The Worker — the window that reads the most code and runs the longest — is the one with the
most to lose and no bound at all.

**This was demonstrated, not inferred.** A ~20 000-token window sent under a 16 384 ceiling came back
with `prompt_eval_count` 15 327, and a variant with an early message removed reported the *same* count
as the unmodified one: the front had already been dropped in both, so the two prompts were identical by
the time the model saw them. The evidence came from the KV-cache measurement done for
[evict-stale-tool-results.md](evict-stale-tool-results.md); it is recorded here because it is a
separate defect from that task's subject.

## Why it is not simply "add the hook"

The interactive failsafe summarizes into `SessionMemory`, which is SQLite-backed and addressable. The
spawned windows persist nothing — they hold a RAM-only `messages` array and are thrown away when the
phase ends. A summary there has nowhere to live and nothing to `/resume` from, which is the whole
reason the hook was only ever built on one side.

Note also that the existing failsafe is **more expensive than eviction**, not less: `appendSummary`
pushes the summary record at the *end* of `state.records`, so a compaction changes the message at
history index 0 and pays a full prompt re-evaluation — 15.0 s on `qwen2.5-coder:14b` and 38.4 s on the
32b at a ~11.6k window — on top of the throwaway summarization inference itself. Whether that ordering
is intentional is its own question (see the open decisions below).

## Relationship to the eviction task

[evict-stale-tool-results.md](evict-stale-tool-results.md) is approved to build **Worker-first**, and
eviction would be that window's first bound of any kind. That does not close this file: eviction
reclaims tokens from tool results, and a window can still fill up on model prose alone. The two are
different instruments for the same failure, and eviction is the cheaper one — at the tail of the
window it costs less than a plain append.

## Open decisions

- **Does a spawned window summarize at all, or only evict?** Summarizing needs somewhere for the
  summary to live and a decision about what `/resume` sees; evicting does not.
- **If it summarizes, does the summary go to the same place?** A Worker summary is not a phase context,
  and `contexts` is keyed on the interactive phases.
- **Is `appendSummary`'s ordering a defect?** Putting the summary of the *oldest* turns last, as the
  newest assistant message, is what makes every compaction cost a full re-evaluation. Moving it to the
  front would make compaction nearly free, but it changes what the model reads and in what order.
- **Does the sub-agent window need this at all?** It is capped at 12 rounds, which may already bound it
  in practice — worth measuring before building anything for it.
