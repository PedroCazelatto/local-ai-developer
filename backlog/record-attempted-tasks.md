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

The shape of a fix is a distinct status in the task's frontmatter, so `/run all` skips it by default while
`/run <id>` still retries deliberately. (This originally proposed *status plus an attempt count*; #2 answered
the status alone — see the decisions below.)

## Not a parity gap

This is a defect in the execution loop, found while comparing the harness against Claude Code but not a
difference *from* it. It is recorded here rather than in
[harness-gaps-vs-claude-code.md](harness-gaps-vs-claude-code.md) because the comparison is not the reason to
fix it — an unattended batch that re-fails last night's tasks is.

It pairs naturally with [budget-ceilings-for-runs-and-batches.md](budget-ceilings-for-runs-and-batches.md),
which introduces a second way for a task to end without a verdict. Both need the same thing: an outcome the
backlog can see and a reason it can distinguish.

## Decisions (answered — OPEN-QUESTIONS.md #2–#6, #70)

- **A fifth `TaskStatus`, `failed`** (#2). `TaskStatus` is `pending | in_progress | done | blocked`
  today (`src/core/session/types.ts`); it grows one member, and `TASK_STATUSES` grows with it. This is
  the shape of the record the rest of the file needed: `resolveSelector('all')` gets something to skip
  on, and the frontmatter write gets something to write. An `attempts: N` count was **not** asked for
  and is not in scope — a status alone answers "was this tried and did it fail".
- **The loop commits the frontmatter itself, via `commitPaths`** (#4 — *changed*; this answer replaces
  the earlier `d`). Order is forced by the stash: `stashTaskAttempt` is `git stash push -u` over the
  whole tree, so the write happens **after** the stash and the commit immediately after the write. The
  precedent is exact — `retro-runner.ts:463` already calls `commitPaths` with a single-element pathspec
  for a rule file, and `commitPaths` stages only the paths it is given and refuses any that escape the
  repo. It is never a bare `git commit`.
- **Nothing needs to tolerate a dirty tree** (#70c, which follows from #4). Because the loop commits,
  the tree is clean again before the next task starts, so `preflightRefusal`, the per-task check inside
  the batch loop, `runOneTask`'s `HALT_DIRTY` and `git_branch`'s switch refusal are all **left exactly
  as they are**. The path allowlist (a) and the threaded known-modified set (b) are both dropped — they
  existed only to accommodate a dirty tree that no longer happens.
- **`/run all` skips a `failed` task by default** (#5a). No flag, no spelling to invent —
  `resolveSelector` parses a bare selector and there is no precedent for `/run` flags.
- **`/run <id>` retries from scratch** (#3a) — today's behaviour. A fresh Worker, the stash never
  reused. Naming the task explicitly *is* the "I fixed the spec, try again" gesture.
- **The apparently-unreachable empty-diff escalation is left alone** (#6c). `setTaskStatus('in_progress')`
  dirties the backlog file for the whole loop, so `changed.files.length === 0` looks unreachable in
  round 1 — confirmed by reading, not by execution. Not this task's problem.

## What this now costs elsewhere

`docs/phases.md`'s **"Who may commit"** list has three entries and none of them is the task loop. It
grows a fourth — *the execution loop commits the backlog file, and only the backlog file, to record an
escalation* — which is a **governance-doc edit and therefore review-gated**: make it in the shipping
commit's working tree and hand the diff over rather than committing it (constitution, *Instruction
integrity*).

The same commit updates [backlog/README.md](README.md)'s line for this task, which still describes the
`pending` behaviour this removes.

## Nothing is open — the ordering was confirmed by reading (#77a)

`verdictGitConflict` cannot see the escalation commit. The commit happens on the MAX_ROUNDS and error
paths, **after** the last Reviewer has spoken, so there is no live verdict to contradict. #77 accepted
the reading rather than requiring a driven test.

**Write the ordering down where it is enforced.** `run-task-loop.ts` gets a comment at the commit site
saying *why* it is safe — the fourth committer is only ever reached once no Reviewer is running — so
that a future edit moving the write earlier has to argue with it rather than discover the collision.
