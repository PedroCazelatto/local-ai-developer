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

## Decisions (answered — OPEN-QUESTIONS.md #3–#6)

- **The loop writes the record into the task's frontmatter, *after* the stash, and the tree is left
  dirty** (#4d). `stashTaskAttempt` is `git stash push -u` over the whole tree, so a frontmatter write
  before it is reset to HEAD and lost with the attempt. The rejected alternatives: a second
  orchestrator-side committer beside Retro's; the Reviewer, which is absent on exactly the MAX_ROUNDS
  and error paths that need the record; and a git-ignored `.orchestrator/` file the committed backlog
  can never show.
- **`/run all` skips a previously-failed task by default** (#5a). No flag, no spelling to invent —
  `resolveSelector` parses a bare selector and there is no precedent for `/run` flags.
- **`/run <id>` retries from scratch** (#3a) — today's behaviour. A fresh Worker, the stash never
  reused. Naming the task explicitly *is* the "I fixed the spec, try again" gesture.
- **The apparently-unreachable empty-diff escalation is left alone** (#6c). `setTaskStatus('in_progress')`
  dirties the backlog file for the whole loop, so `changed.files.length === 0` looks unreachable in
  round 1 — confirmed by reading, not by execution. Not this task's problem.

## Blocked on

- **#2 — the shape of the record itself, which is the centre of the task.** A new `TaskStatus` member,
  an `attempts: N` count, or both? Answered "I didn't understand"; re-stated in
  [OPEN-QUESTIONS.md](../OPEN-QUESTIONS.md) #2. Nothing else here can be built without it: #5's
  "skip by default" needs something to read, and #4's write needs something to write.

## Falls out of #4d and needs a decision

Choosing (d) leaves the project tree permanently dirty by one file, and **three separate gates refuse a
dirty tree today**:

- `preflightRefusal` (`batch.ts`) — refuses to *start* a batch at all;
- the per-task check inside the batch loop — skips every task after the first failure;
- `runOneTask`'s `HALT_DIRTY` in `run.ts`, and `git_branch`'s `switch` refusal.

Each has to learn to tolerate exactly the backlog file the loop wrote, or a single escalation silently
ends every subsequent run. How — a path allowlist, a "known-modified" set carried through the batch, or
something else — is not decided.
