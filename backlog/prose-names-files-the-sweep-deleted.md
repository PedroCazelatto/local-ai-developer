# Fourteen comments still name files the sweep deleted

**Category:** Repo hygiene

Backlog item 1's sweep renamed or deleted almost every file in `src/core/session/`. **Fourteen comments
across the tree still point at four files that no longer exist**, and because they are prose, nothing
will ever surface them — no compiler error, no failing test, no lint. A reader follows the pointer, finds
nothing, and has to reconstruct which file inherited the behaviour.

| dead name | successor | sites |
|---|---|---|
| `turn-loop.ts` | `run-turn.ts` | `session-memory.ts:319`, `session-orchestrator.ts:4`, `session-orchestrator.ts:409`, `worker-window.ts:156`, `core/ui/status-activity.ts:1` |
| `worker-runner.ts` | `worker-window.ts` / `run-worker-task.ts` | `is-evictable-tool.ts:44`, `read-tracker.ts:5`, `session-orchestrator.ts:123`, `tools/commit-changes.ts:8`, `tools/git-stash.ts:11`, `tools/index.ts:34` |
| `reviewer-runner.ts` | `reviewer-window.ts` / `run-reviewer-task.ts` | `read-tracker.ts:5`, `phases/phase-tool-names.ts:3`, `tools/commit-changes.ts:8` |
| `retro-runner.ts` | `retro-window.ts` / `spawn-retro.ts` | `read-tracker.ts:5`, `phases/phase-tool-names.ts:4` |

Plus one outside `src/`: **`OPEN-QUESTIONS.md:957`** names `events-log.type.ts` in the present tense, and
that file was retired in `54eb8b4` — its three types folded into `events-log.ts`.

Two of the sites name more than one dead file (`read-tracker.ts:5` names three), which is why fourteen
sites cover more than fourteen references.

## Why this is worth a task rather than a sweep-as-you-go

**Every wave of item 1 fixed only the stale prose its own change caused**, deliberately: a wave that
edits a comment in a directory it does not own puts two agents in the same file, which is exactly the
contention the per-directory partition existed to prevent. So these accumulated by design, not by
neglect, and they are the residue of that policy rather than a failure of it.

They are also **not evenly distributed in difficulty.** Six of the fourteen sit in `src/tools` and
`src/phases`, describing *which phase refuses which tool* — `worker-runner refuses this tool;
reviewer-runner allows it`. Those sentences are about a **policy boundary**, and the successor is not a
single file: the Worker's refusal now lives in `worker-window.ts`'s `WORKER_REFUSALS` while the phase
gate lives in `phase-tool-names.ts`. **Repointing them at one file would be less accurate than leaving
them, so this is an editing job, not a find-and-replace.**

## What makes it more than tidiness

The sweep has already produced **four headers that asserted something false**, each found only because
someone read the code beside the comment: `truncate-to-width.ts` promising columns and counting code
units, `taskBranchName` claiming to strip what git chokes on, `append-jsonl-line.ts` under-claiming by
two, and `read-tracker.type.ts` justifying itself with *"src/tools never imports session internals"* when
about twenty files in `src/tools` import runtime values from `core/session`. **A pointer to a deleted
file is the same class of defect at a lower severity** — prose that a reader is entitled to trust and
cannot.

## Decisions, open

- **Do the six policy sentences get repointed, rewritten, or left?** They are the only ones where the
  successor is ambiguous. Rewriting them to name the *concept* (`the Worker window refuses it; the
  Reviewer is allowed it`) rather than a file would make them durable against the next rename — which may
  be the better answer, and is a change of style rather than a correction.
- **Is `OPEN-QUESTIONS.md` in scope?** It is a historical record of answered questions, so a present-tense
  reference to a since-deleted file may be correct *as of when it was written*. If so, it wants a dated
  note rather than an edit.
- **Should the barrel-relative sites wait for wave E?** `tools/index.ts:34` is inside a barrel that wave E
  deletes, which resolves one site for free.

## Why it sits where it does

Small, independent, and nothing depends on it. **Ships after wave E**, which deletes one of the fourteen
sites outright and may move others. Filed rather than folded into item 1 for the reason that governed the
whole sweep: an edit to a directory a wave does not own is contention, and a comment change buried in a
mechanical refactor is a change nobody reviews.
