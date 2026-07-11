> **Status:** ✅ Completed (2026-07-11)

# 05 — Unattended batch execution (run it overnight)

**Version:** V3
**Depends on:** V3/01 (the per-task fix loop), V3/02 (`raise_blocker` → blocked outcome), V2/03 (auto-commit on accept), V1/09 (task-backlog format), V1/10 (execution trigger: one / some / all)
**Blocks:** nothing — this is the V3 milestone deliverable ("kick off a batch and walk away")

## Why

CLAUDE.md "Execution phases" + the non-goals: *"The intended way to scale is to start a batch and let it run unattended (e.g. overnight) … tasks run sequentially. No parallelism."* The ROADMAP V3 exit criterion is: *"kick off a multi-task batch, leave; come back to committed passing tasks, a tidy escalation queue for the ambiguous ones, and Retro-applied patches awaiting review."* This task ties V3/01's loop, V3/02's escalation/blocker handling, and V2/03's commit together into one driver that walks the whole backlog **sequentially** without a human in the inner loop, and prints a summary when it's done.

## Behavior

### Trigger

The V1/10 execution trigger already chooses **one / some / all** tasks. This task implements the **batch** path (all, or a multi-task subset) running **unattended**:

```ts
runBatch(taskIds: string[]) -> BatchSummary
```

Tasks run **strictly sequentially** — one task's `runTaskLoop` (V3/01) fully completes (or halts) before the next starts. No parallelism: the 3060's VRAM holds one window at a time.

### Per-task outcomes feed the batch

For each task, `runTaskLoop` returns a `TaskLoopResult` (V3/01) with one of three outcomes; the batch routes each **without aborting the whole run** where avoidable:

- **`passed`** → already auto-committed (V2/03); record it and continue.
- **`escalated`** (5 failed rounds) → append to the escalation queue with the last Reviewer feedback; **do not** abort the batch; continue to the next task.
- **`blocked`** (Reviewer called `raise_blocker`, V3/02) → append the question to the escalation queue; in unattended mode the orchestrator does **not** wait for an answer (no human is present) — it records the blocker (persisted in `blockers.jsonl` per V3/02) and continues to the next task. The user resolves blockers later, which then triggers Retro (V3/03) and a re-run.

A blocker or an escalation is a **per-task** result, not a batch failure. The batch only aborts on a genuine infrastructure fault (e.g. the sandbox container is unreachable, Ollama is down) — and even then it records progress so far and exits cleanly with what it completed.

### A systemic Retro patch pauses the batch

If a blocker is resolved during the run and Retro (V3/03) produces a **systemic** edit under `rules/phases/` (uncommitted, needs human review), the batch must **not** silently continue past it — per the git-policy invariant. In practice an unattended batch defers blocker resolution to the user anyway, so this mainly applies when a human is intermittently present; honor the V3/03 pause regardless.

### End-of-batch summary

When the queue empties (or an infra fault stops it), print a summary and persist it:

```ts
interface BatchSummary {
  startedAt: string;          // UTC ISO
  finishedAt: string;         // UTC ISO
  total: number;
  passed: { taskId: string; commit: string; rounds: number }[];
  escalated: { taskId: string; rounds: 5; lastFeedback: string }[];
  blocked: { taskId: string; blockerId: string; question: string }[];
  tokens: { prompt: number; completion: number };  // EXACT, summed across every task's loop
}
```

The terminal prints a compact table — counts of passed / escalated / blocked, the escalation queue (so the user knows exactly what needs attention), and the exact total token spend. Persist it to `projects/<active>/.orchestrator/batches/<startedAt-ulid>.json` so the user can read the morning-after report even after the REPL is gone.

## Files

- `src/core/session/batch.ts` — new; `runBatch` driver: sequential iteration over the backlog, per-task outcome routing, escalation queue, summary assembly, persistence.
- `src/core/session/orchestrator.ts` — touched; the V1/10 trigger dispatches the "all" / multi-task selection to `runBatch`; a single-task selection still runs one `runTaskLoop` directly.
- `src/core/ui/*` — touched; live progress while the batch runs (`task 4/12 · round 2/5`), and the end-of-batch summary table.
- `src/core/session/backlog.ts` (V1/09 reader) — touched/reused; supply the ordered task ids and let `runBatch` mark per-task status (passed / escalated / blocked) back in the backlog.

## Notes / pitfalls

- **Strictly sequential.** No `Promise.all`, no concurrent windows. One task at a time, full stop — this is a hard constraint (VRAM), not a perf preference.
- **A blocker/escalation must not abort the batch.** The entire value of "run it overnight" is that one ambiguous task doesn't waste the other eleven hours. Queue it and move on. Reserve aborts for true infra faults, and even then exit with a partial summary rather than crashing.
- **Unattended ≠ guessing.** In a batch with no human present, a `blocked` task is queued, not answered — never fabricate a blocker resolution to keep going (CLAUDE.md V3/02: nothing proceeds on a guess).
- **Tokens are exact.** `BatchSummary.tokens` is the sum of every task's `TaskLoopResult.tokens`, which are themselves exact Ollama counts (CLAUDE.md). Never estimate the batch total from message lengths.
- **Only `passed` tasks are committed** (via V2/03, already done inside the loop). Escalated/blocked tasks leave the working tree as-is for the user to inspect — don't commit partial work.
- **Resumability is nice-to-have, not required here.** The persisted summary + the per-task backlog status are enough for the user to see where things stopped; a full "resume the batch from task N" is out of scope unless it turns out to be needed when V3 is built.
- Honor the V3/03 systemic-patch pause: an uncommitted `rules/phases/` change must surface before the loop continues past it.

## Acceptance

- In a live `run start` session, queue an **all-tasks** batch on a backlog containing: a couple of clear tasks, one task that fails 5 rounds, and one self-contradictory task. Walk away. On return:
  - the clear tasks are **committed** (visible in `git log` of the project repo) with `passed` entries in the summary,
  - the 5-fail task is in the **escalation** queue with its last feedback, **uncommitted**,
  - the self-contradictory task is in the **blocked** queue with the Reviewer's `raise_blocker` question, and a `raised` row exists in `blockers.jsonl`,
  - the batch ran them **one at a time** and **did not abort** on the escalation or the blocker.
- The end-of-batch summary table prints correct counts (passed / escalated / blocked) and an **exact** total token spend that equals the sum of the per-task loop tokens.
- The summary is persisted under `projects/<active>/.orchestrator/batches/` and is readable after the REPL exits.
- Resolving a queued blocker afterward triggers Retro (V3/03); a resulting **systemic** patch is left uncommitted with the review warning, and the loop does not silently continue past it.
