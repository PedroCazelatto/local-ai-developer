# Give the model guardrailed git tools

**Category:** Tools / git

The model must never be handed the in-app slash-commands themselves. It gets **tools that do the same
job with guardrails** — this task covers git beyond the two tools that already exist.

`list_changes` and `commit_changes` stay exactly as they are, including the rule that the committing
phase never writes its own message (`composeCommitMessage` hands the real diff to a throwaway one-shot).
Each new operation is its **own tool file** with its own schema and its own refusal rules, rather than
one `git(operation, args)` tool branching internally.

## Operations

- **Stash** — save / list / pop / drop.
- **Read-only inspection** — diff / log / show.
- **Branch + checkout** — create and switch branches inside the project repo.
- **Push.**

## Push rules

The model may push. A **missing GitHub repository is an error** — the model never creates the
repository, so a push with no destination fails with a recoverable message and the user creates it.
A **branch that does not exist on the remote may be created by the push** itself.

## Guardrails to preserve

- Every git call goes through `-C <projectPath>` with an argv and no shell, so nothing can escape the
  project repo — the guard that keeps an edit to the orchestrator's own [rules/](../rules/) out of a
  model-made commit.
- Inspection output is **bounded** (`REVIEW_DIFF_BUDGET` already exists for this), so a large diff or
  a long log cannot quietly consume `num_ctx`.

## Implementation hazard

`src/core/session/project-git.ts` already has stash plumbing, but it is keyed to a **task id** and
labelled `lad-stash:<taskId>` — `stashTaskAttempt` / `readTaskStashDiff` / `dropTaskStash` are how the
task loop preserves a failed attempt for Retro or the user. A model-facing stash needs its **own
labelling scheme**; sharing the prefix would let the model pop or drop the record the task loop
depends on.

## Still open

- **Which of these the Worker may call.** `commit_changes` is already stripped from the Worker window
  so it cannot gatekeep its own code. Whether it may stash, branch, or checkout is undecided.
- **Checkout against a dirty working tree** — refuse, or stash first?
