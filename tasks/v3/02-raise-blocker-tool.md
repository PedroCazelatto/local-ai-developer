> **Status:** ✅ Completed (2026-07-11)

> **Implemented as (decisions that refine the plan below):**
> - **Gating is phase-scoped, not registry-gated.** Like `submit_verdict` (V2/01), `raise_blocker`
>   lives OUTSIDE the global registry and is offered only inside the Reviewer window
>   (`reviewer-runner.ts`), so the Worker — sent the whole registry — literally cannot see it. The
>   `not_authorized` result is a defense-in-depth guard in the shared handler (`validateBlockerRequest`);
>   a stray call from another phase actually falls through dispatch as `unknown tool`.
> - **Interactive /run is skip-and-continue, not pause.** On a blocker the task is marked `blocked`, its
>   throwaway changes reverted (`discardWorkingTreeChanges`), and the run moves on to other runnable
>   tasks (dependents skip naturally on unmet deps). When nothing runnable remains the run ends; the
>   user answers with **`/answer <task-id> <text>`** (records the `resolved` row + re-queues
>   `blocked→pending`) and re-runs. `/answer` never restarts the loop. (Retro spawn on answer is V3/03.)
> - **Blocker ids are `${taskId}#${n}`** (a per-task question counter), not a ULID — no id dependency
>   exists yet (V3/04's inbox). `blockers.jsonl` under `.orchestrator/`, append-only, replayed for state.

# 02 — `raise_blocker` tool (Reviewer-only loop halt)

**Version:** V3
**Depends on:** V3/01 (the fix loop this short-circuits), V2/01 (Reviewer phase), V1/02 (tool registry + dispatch), V1/06 (tool audit log)
**Blocks:** V3/03 (Retro fires after a blocker is resolved), V3/05 (batch queues blockers)

## Why

CLAUDE.md "Loop control": *"Only the Reviewer can call `raise_blocker(question)`. The Worker cannot — making the Reviewer the sole gatekeeper is deliberate (a local model is more often confidently-wrong than self-aware, so self-reported confusion from the Worker isn't trustworthy)."* The Reviewer calls it **immediately** on a genuinely ambiguous, under-specified, or self-contradictory task definition; the loop halts at once and the question is surfaced to the user; nothing proceeds until the user answers. This task adds the tool, gates it to the Reviewer phase, and defines the halt → wait → resume mechanism.

## Behavior

### Signature

```ts
raise_blocker(question: string) -> RaiseBlockerResult
```

The tool is exposed to the model **only when the active phase is Reviewer**. The tool registry (V1/02) must filter it out of the Worker's (and every other phase's) tool definitions, so the Worker literally cannot see or call it.

### Structured results (recoverable errors per the conventions)

```ts
// Accepted: the loop will halt after this Reviewer turn returns.
{ ok: true, blocker: { id: string, question: string, raisedAt: string /* UTC ISO */ } }

// Rejected (structured, recoverable — the model reads it and continues its turn):
{ ok: false, error: "empty_question",  message: "question must be a non-empty string" }
{ ok: false, error: "not_authorized",  message: "raise_blocker is Reviewer-only" }  // defense in depth
```

`id` is a ULID (sortable + short), consistent with the inbox store (V3/04). `not_authorized` is belt-and-suspenders: the registry should already hide the tool from non-Reviewer phases; if a call somehow arrives from another phase, reject it here too rather than honoring it.

### Halt → wait → resume

1. **Halt.** When the Reviewer's turn calls `raise_blocker` and it returns `ok: true`, `runTaskLoop` (V3/01) ends the current task with `outcome: "blocked"` and the `question` — **before** running any further round. No fix round, no commit. The blocker carries the task reference, the round number it was raised on, and the Reviewer's verdict context.
2. **Surface + wait.** The orchestrator presents the question to the user. In an **interactive** session the loop is paused awaiting the answer; in an **unattended batch** (V3/05) the blocker is appended to the escalation queue and the batch moves on to the next task without aborting (a blocker is not a crash).
3. **Resume.** When the user answers, the orchestrator records the answer against the blocker `id`, then (per V3/03) spawns the **Retro** window with `{ task, misunderstanding, answer }`. After Retro patches the correct file, the task is re-queued for a fresh loop run (a new Worker window — the blocked Worker's history is discarded). The user, not the orchestrator, decides when to re-run a blocked task in interactive mode.

### Persisted blocker record

A blocker is durable so an unattended batch can be reviewed later and survive a restart. Append to `projects/<active>/.orchestrator/blockers.jsonl` (append-only, replay for state — same discipline as the inbox in V3/04):

```json
{ "kind": "raised",   "id": "01HF...", "taskId": "story-3-task-2", "round": 2,
  "question": "Spec says 'idempotent' but acceptance asserts a counter increments — which?",
  "raisedAt": "2026-06-21T22:14:03.512Z" }
{ "kind": "resolved", "id": "01HF...", "answer": "Idempotent wins; drop the counter assertion.",
  "resolvedAt": "2026-06-21T23:02:10.004Z" }
```

State (open vs. resolved) is reconstructed by replay. The `raise_blocker` tool call itself is also written to the V1/06 tool audit log like every other call.

## Files

- `src/tools/raise-blocker.ts` — new; the tool definition + handler returning the structured result above; Reviewer-only registration.
- `src/core/session/blocker-store.ts` — new; append-only JSONL writer/reader for `blockers.jsonl`, ULID ids, UTC timestamps, replay to derive open/resolved.
- `src/core/session/task-loop.ts` — touched (V3/01); detect the blocker signal coming back from the Reviewer turn and return `outcome: "blocked"` without running a fix round.
- `src/tools/registry.ts` (or wherever V1/02 builds per-phase tool definitions) — touched; gate `raise_blocker` to the Reviewer phase only.
- `src/core/session/orchestrator.ts` — touched; surface the blocker to the user (interactive) or hand it to the batch queue (V3/05), record the answer, trigger Retro (V3/03).
- `rules/phases/reviewer.md` — touched; document that `raise_blocker` exists, that it is Reviewer-only, and that it should be called **immediately** on genuine ambiguity/under-specification/self-contradiction (not for ordinary `fail` feedback — those go in the verdict).

## Notes / pitfalls

- **Worker must never see this tool.** The gating lives in the registry, not just in a prompt instruction — a prompt the local model can ignore is not a guarantee. Verify the Worker's tool definitions omit `raise_blocker` entirely.
- **`raise_blocker` is not a `fail`.** A normal review failure returns the V2/01 verdict and the loop runs a fix round. `raise_blocker` is reserved for cases the Worker *cannot* fix because the task itself is ambiguous/contradictory. Make this distinction explicit in `reviewer.md` so the model doesn't blocker-spam instead of giving fix feedback.
- **Halt is immediate.** Once raised, no fix round runs and nothing commits — the loop returns at once. Don't let a "one more round" path slip through.
- **Nothing proceeds until the user answers** (interactive). In a batch, "proceed" means "move to the next task," not "guess an answer" — never fabricate a resolution.
- **Errors are recoverable.** An empty/whitespace `question` returns `error: "empty_question"`; it does not throw and kill the Reviewer's turn.
- Tokens for the Reviewer turn that raised the blocker are still summed exactly into the V3/01 result.

## Acceptance

- In a live session, give the Worker a self-contradictory task. The Reviewer calls `raise_blocker(question)`; `runTaskLoop` returns `outcome: "blocked"` with that exact `question`, on the round it was raised — and **no** fix round ran, nothing was committed.
- Inspecting the Worker's tool definitions for the same session shows `raise_blocker` is absent (Worker cannot call it). A forced call from a non-Reviewer phase returns `error: "not_authorized"`.
- `blockers.jsonl` has a `raised` row after the halt; after the user answers, a matching `resolved` row appears; replaying the file yields the blocker as resolved.
- The `raise_blocker` call also appears in `tool_audit.jsonl` (V1/06).
- Calling `raise_blocker("")` returns `{ ok: false, error: "empty_question" }` and the Reviewer turn continues rather than crashing.
