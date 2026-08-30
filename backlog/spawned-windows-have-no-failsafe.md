# The spawned windows have no summarization failsafe

**Category:** Memory / context

`beforeModelCall` — the hook that triggers summarization when a history crosses
`SUMMARIZATION_THRESHOLD_RATIO × num_ctx` — exists **only on `SessionOrchestrator`**. Neither
`reviewer-runner.ts`, `retro-runner.ts` nor `subagents.ts` implements it, and `worker-runner.ts`
implements the hook but not summarization: it runs `evictStaleToolResults` and nothing else.

So the three interactive phases have a failsafe and the **six** spawned windows have none — the four
this file was filed on plus the two debate windows, which #22a brought into scope. Past `num_ctx`
Ollama silently drops the oldest tokens of the prompt and returns a perfectly ordinary-looking
response. The Worker — the window that reads the most code and runs the longest — is the one with the
most to lose and no bound at all.

**This was demonstrated, not inferred.** A ~20 000-token window sent under a 16 384 ceiling came back
with `prompt_eval_count` 15 327, and a variant with an early message removed reported the *same* count
as the unmodified one: the front had already been dropped in both, so the two prompts were identical by
the time the model saw them. The evidence came from the KV-cache measurement done for
the **evict stale tool results** task (shipped); it is recorded here because it is a
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
is a defect was its own question; it is settled below, and the answer is no.

## Relationship to the eviction task

The **evict stale tool results** task shipped **Worker-first**, and eviction is
that window's first bound of any kind. That does not close this file: eviction
reclaims tokens from tool results, and a window can still fill up on model prose alone. The two are
different instruments for the same failure, and eviction is the cheaper one — at the tail of the
window it costs less than a plain append.

## Decisions (answered — OPEN-QUESTIONS.md #22–#27)

- **All six windows are in scope** (#22a): Worker, Reviewer, Retro, sub-agent, and **both debate
  windows**. The debate pair was not in this file's original count of four. Including them does not
  make [cap-the-debate-background-parameter.md](cap-the-debate-background-parameter.md) redundant — a
  cap bounds what `background` contributes at index 1, and only a failsafe bounds five rounds of
  argument growing on top of it.
- **A spawned window summarizes** (#23a) — `oneShot('summarize')`, the same instrument the interactive
  failsafe uses. The measured cost is accepted: 15.0 s on the 14b, 38.4 s on the 32b, per compaction,
  per window, inside an unattended batch. Non-inference compaction (b) was rejected because dropping
  the oldest exchange whole loses content that eviction already reclaims more surgically, and
  terminating the window (c) costs the task outright.
- **Index `[0]` and index `[1]` are both protected; only the model↔user and model↔model messages after
  them are summarized** (#24a). This is the answer this file most needed: `[1]` is the window's
  **seed** — the Worker's task definition and spec slice, the Reviewer's changed files and last test
  run, Retro's misunderstanding and stashed diff. A window that loses its seed has lost its contract
  and its output is worthless. The interactive failsafe protects `[0]` alone only because an
  interactive phase has no seed.
- **The trigger is the existing `SUMMARIZATION_THRESHOLD_RATIO`, 0.75** (#25a) — after eviction has had
  its run at 0.6. No third tunable, no new number to justify, and the two mechanisms stay
  independent (a decline is still silent, and nothing is coupled to it).
- **The sub-agent gets the hook** (#26b), regardless of whether 12 rounds can reach the ceiling. This is
  the most work of the six: `subagents.ts` has **no seam at all** — `runTurns` pushes onto
  `state.messages` and calls `llm.chat` directly, never going through `processMessage`. The seam has to
  be created, not hooked.
- **`summarization_fire` is reused, with a phase field, and a sub-agent's row carries `subagentId`**
  (#27a). No new event type. The `subagentId` matters for the same reason `subagent_spawn` carries
  one — without it, two sub-agents' rows are indistinguishable.

## What is deliberately not decided here

**`appendSummary`'s ordering is left alone.** This file previously listed it as an open decision on the
grounds that appending the summary last is what makes every compaction pay a full prompt
re-evaluation. The KV-cache measurement done for
the **evict stale tool results** task (shipped) settled the premise rather than the
question: the cached prefix dies at the **first collapsed index** either way, so moving the summary to
the front would not make compaction cheap. There is no saving to chase, and the ordering question is
therefore purely about what the model reads — which #24a answers.

## Still open

- **#81 — where does a spawned window's summary live?** The interactive failsafe summarizes into
  `SessionMemory`, which is SQLite-backed, addressable and `/resume`-able. A spawned window persists
  nothing: it holds a RAM-only `messages` array and is thrown away when the phase ends. #23a says it
  summarizes; nothing says whether that summary is durable, and `contexts` is keyed on the interactive
  phases. See [OPEN-QUESTIONS.md](../OPEN-QUESTIONS.md) #81.
- **#82 — a debate window that compacts is a debate that forgot its own argument.** The two debate
  windows are now in scope (#22a) but they are the one pair where compaction is not obviously safe: a
  challenger whose earlier objections were summarized may re-raise them, and `MAX_DEBATE_ROUNDS` is 5,
  so the window dies shortly after. Whether they compact, or simply end the debate at the threshold,
  is not decided. See [OPEN-QUESTIONS.md](../OPEN-QUESTIONS.md) #82.
