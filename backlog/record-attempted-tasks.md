# Stop a failed task from looking untouched

**Category:** Execution loop

`TASK_STATUSES` is `pending | in_progress | done | blocked` (`src/core/session/types.ts`). There is no
terminal-failure state, and nothing anywhere records that a task was attempted.

So a task that burns all five rounds without a pass is set back to **`pending`** (`run-task-loop.ts`, both the
MAX_ROUNDS exit and the error paths), at which point it is indistinguishable from a task nobody has ever
touched. `resolveSelector('all')` takes everything that is not `done`, so the next `/run all` picks it up and
spends another five rounds on it — with a fresh Worker that starts blind, since the stash is deliberately
never reused.

Blocked tasks do not have this problem: they stay `blocked` until `/answer`, which is exactly the right shape.
It is only escalation that forgets.

**Why this is worse than it first looks.** The escalation *is* recorded, in the batch summary under
`.orchestrator/batches/`. But nothing reads that back — that is the `/batch` item in
[inspection-commands.md](inspection-commands.md). So the only durable record of "this was tried and it failed"
sits in a file the tool cannot show, while the backlog file that actually drives scheduling says `pending`. Two
`/run all` invocations overnight can spend the second half of the night re-failing the first half's tasks.

The shape of a fix is a distinct status plus an attempt count in the task's frontmatter, so `/run all` skips it
by default while `/run <id>` still retries deliberately.

## Not a parity gap

This is a defect in the execution loop, found while comparing the harness against Claude Code but not a
difference *from* it. It is recorded here rather than in
[harness-gaps-vs-claude-code.md](harness-gaps-vs-claude-code.md) because the comparison is not the reason to
fix it — an unattended batch that re-fails last night's tasks is.

It pairs naturally with [budget-ceilings-for-runs-and-batches.md](budget-ceilings-for-runs-and-batches.md),
which introduces a second way for a task to end without a verdict. Both need the same thing: an outcome the
backlog can see and a reason it can distinguish.

## Open decisions

- **Whether the status vocabulary grows, or the attempt count alone carries it.** A new status is clearer to
  read in a task file; a count is less invasive to everything that switches on status.
- **What re-running a failed task means.** Retry from scratch (today's behavior), or refuse without an explicit
  override.
- **Where the count is written, and by whom.** The Reviewer owns `mark_task_done` and is the only execution
  actor that commits, so a counter written by the loop is a new writer of task files.
- **Whether a `/run all` that skips previously-failed tasks is the default** or an opt-in flag. The
  unattended-batch use case argues for skipping by default; the "I fixed the spec, try again" case argues the
  other way.
