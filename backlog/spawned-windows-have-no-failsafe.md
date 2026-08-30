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

## The summary is always persisted, resumable or not (#81)

> *"Always record whatever is generated into the database, even when the user cant resume from it."*

This settles the objection in *"Why it is not simply add the hook"* above by rejecting its premise. That
section argued a spawned summary *"has nowhere to live and nothing to `/resume` from, which is the whole
reason the hook was only ever built on one side."* The rule is now that **durability and resumability
are separate concerns**: everything a model generates is written down, and whether a human can replay it
is a different question with a different answer.

The practical consequence is that a Worker that compacted twice overnight leaves a readable trace of
what it decided to forget — which is exactly the thing an unattended batch otherwise destroys silently.

**It reuses the existing tables** (#97): *"reuse the same table, so we can also read the full
thinking/conversation process by reading the rows."*

Read carefully, that is more than storing a summary. A spawned window gets a `contexts` row and its
turns become `messages` rows, exactly as an interactive phase's do — so the Worker's whole reasoning
trace, not just what it compacted away, becomes readable after the fact. **That is a scope increase on
this task** and it is the point: an unattended overnight batch currently destroys every spawned window
it opens, and the summary alone would only record what was forgotten, never what was done.

**The schema barely moves.** `contexts` is `(id, phase, title, num_ctx, timestamps)` and `messages` is
`(context_id, seq, role, content, model, tool_name, tool_calls, prompt_tokens, completion_tokens, …)`.
`phase` is plain `TEXT` with no `CHECK`, and `role` already allows `'summary'`. A Worker window is a row
with `phase = 'worker'`.

**The one hazard is closed by a naming rule** (#101b). `/swap` validates against
`availablePhases()`, which is every file in `rules/phases/` — **including `worker`, `reviewer` and
`retro`** — so `/swap worker` is legal today, and a spawned window writing `phase = 'worker'` would put
its rows in front of `/resume` as though they were resumable.

So a spawned window writes a **namespaced** phase: **`worker:spawned`**, `reviewer:spawned`,
`retro:spawned`, `subagent:spawned`, and the two debate roles likewise. A colon can never appear in a
phase name that came from a filename, so the namespace is unforgeable and `/resume`'s existing
`phase = ?` filter excludes spawned rows **by construction** — no new column, no migration, and no
predicate to remember to update.

Two implementation notes that follow:

- **The record name and the prompt name come apart.** A spawned Worker records `worker:spawned` but
  still loads its system prompt from `rules/phases/worker.md`, so the write path needs a one-line map
  from the namespaced name back to the base. Keep that map in one place; two spellings of the same
  phase is exactly the kind of thing that drifts.
- **`/swap worker` stays legal and is now harmless** — it holds an interactive conversation on the
  Worker's prompt, under `phase = 'worker'`, which no spawned row can collide with. It is an ability
  no doc describes, and it is out of scope here; worth a line in `docs/cli.md` whenever that file is
  next touched.

Two consequences worth pricing before building:

- **Volume.** A Worker across 5 rounds x up to 24 calls is hundreds of `messages` rows per task, times
  every task in a batch. `memory.db` stops being a record of a few interactive conversations.
- **Overlap with the audit log**, which already records every tool call at its single choke point. The
  two answer different questions — one *what was called*, one *what was said* — but they will grow
  side by side, and [move-the-logs-into-sqlite-tables.md](move-the-logs-into-sqlite-tables.md) is
  moving the audit log into this same database.

## The debate windows compact like the others (#82a)

No special case. A challenger that has to re-derive an objection it already made is a worse debate than a
short one, but it is still a debate; ending the loop at the threshold would let a large `background` (up
to 12 000 characters, capped but not small) truncate the argument on round three. With `MAX_DEBATE_ROUNDS`
at 5 and the cap in place, a compaction there should be rare — and when it fires it is recorded like any
other (#27a), so its rarity is measurable rather than assumed.
