# Phases and how a session works

`node scripts/run.mjs start <project-name>` boots the orchestrator locked to one project. Switching
projects requires restarting the orchestrator process. All planning artifacts a project produces live
**inside the project repo**, not in the orchestrator repo — each project carries its own agent files.

Work is organized into **phases**: an instruction set loaded into a context window (see
[mental-model.md](mental-model.md)). Planning phases are interactive — the user drives them.
Execution phases are spawned automatically once the user triggers a batch.

## Planning phases (interactive — the user drives, loops freely)

The user is questioned about every detail; the output documents what to build, what *not* to build,
and what is deferred to later versions. A seed "idea" is almost always a bundle of features, so
planning decomposes it through a Scrum-style hierarchy: **Idea → Epics → Stories → Tasks.**

| Phase | Produces | Notes |
|---|---|---|
| **Discovery** | Requirements + versioned scope, and the list of features with their interactions, grouped into one or more **Epics** | Interviews the user via `ask_user`. Thinking about feature interactions up front is what makes an epic coherent. |
| **Design** | Splits an epic into **Stories** (and the architecture/boundaries that hold them together) | Iterates **together with** Breakdown — design and decomposition inform each other. |
| **Breakdown** | Splits stories into the ordered, prioritized **Task** list the execution loop consumes | Works **per-story** to balance richer context against the `num_ctx` limit. Holds the Product Owner + Sequencer responsibilities; split it back into separate phases if it grows two distinct jobs. |

These phases are **non-linear** — the user can loop back (Discovery ⇄ Design ⇄ Breakdown) to revise
scope, re-architect, or re-sequence at any time before triggering execution.

### Asking the user

A planning phase asks through the **`ask_user`** tool, never through prose the user has to read and
answer by hand. It puts a round of **up to 5 multiple-choice questions** (bounded rounds, enforced in
code) to the user in a tabbed terminal panel — one tab per question, a final **Review** tab, arrow
keys to move, Enter on Review to submit. Every question carries at least 2 concrete options the model
guessed at, plus a free-text choice the orchestrator always appends, so the user can never be
cornered by options the model failed to imagine.

- **Interactive phases only.** Discovery/Design/Breakdown get `ask_user`; the spawned execution
  windows (Worker/Reviewer/Retro) do **not** — they run unattended (the user starts a batch and walks
  away), so a question would stall the batch on a keypress nobody is there to press. Execution
  escalates through the Reviewer's `raise_blocker`, which is asynchronous by design.
- **Skipping is normal, and nothing is lost.** A question the user moves past is saved durably
  (`.orchestrator/questions.jsonl`); `/questions` re-offers every saved question whenever the user
  chooses. The answer is injected into the context of the phase that asked, on its next turn — across
  a phase swap or a restart. The asking phase is told plainly not to re-ask a skipped question.

## Execution phases (automatic — the user triggers, then it runs)

The user starts execution explicitly and chooses the batch: **one task, some tasks, or all tasks**,
then walks away. Tasks run sequentially. For each task the orchestrator spawns fresh windows and runs:

```
implement → test → review → fix → (loop, max 5 rounds)
```

- **Worker** — a fresh window with the task definition; writes failing tests first, then implements,
  then runs the tests. **The same Worker window does the fixes** — its history accumulates every prior
  attempt plus the Reviewer's feedback, so it converges in as few rounds as possible rather than
  starting blind each time. It **cannot commit** (see *Git / commit policy*).
- **Reviewer** — a separate fresh window that judges the Worker's output against the task definition,
  and the only phase in the loop that commits. It may accept **part** of an attempt: it commits the
  files it approves, and every file it leaves behind goes back to the Worker with an issue explaining
  why. Files already accepted are named in the next fix turn so the Worker doesn't redo them.
- **Loop control:**
  - Hard cap of **5** implement→fix rounds per task. If the work still hasn't passed review after 5
    rounds, the loop stops and **escalates to the user**.
  - **Only the Reviewer can call `raise_blocker(question)`.** The Worker cannot — making the Reviewer
    the sole gatekeeper is deliberate: a local model is more often confidently-wrong than self-aware,
    so self-reported confusion from the Worker isn't trustworthy.
  - The Reviewer calls `raise_blocker` **immediately** on genuine confusion — an ambiguous,
    under-specified, or self-contradictory task definition. The loop halts at once and surfaces the
    question to the user; nothing proceeds until the user answers.

## Retro phase (automatic — fires after the user resolves a blocker)

When the user answers a blocker, the orchestrator spawns a **Retro** window with `{the task, the
misunderstanding, the user's answer}`. It diagnoses *what* went wrong and *where*, then patches the
correct file so the mistake does not recur:

- **Systemic** — something that *should* have been caught during Discovery/Design/Review → edit the
  **global** phase instruction file under [rules/](../rules/).
- **Task-specific** — a one-off gap in this task's definition → edit the **project** doc only.

## Cross-phase communication: the inbox

Each window has its **own isolated history** and never sees another phase's turns, so cross-phase
signals go through a durable, append-only inbox (`src/core/session/inbox-store.ts`, one JSONL file per
recipient phase) exposed as three tools:

- `inbox_post(to, body)` — post a concern to another phase's inbox. The sender is the active phase;
  the model never names itself. `to` is validated against the closed six-phase set.
- `inbox_read(status)` — read **your own** inbox (recipient derived from the active phase).
  `"open"` (default) returns unresolved items; `"all"` returns full history.
- `inbox_resolve(id, note)` — close an item with a one-line note. Any phase may resolve an item it
  did not receive; the resolver is recorded distinctly from the recipient.

Protocol: a phase calls `inbox_read` at phase start and addresses every open item before starting new
work; it calls `inbox_post` whenever it spots a concern that belongs to another phase.

## Git / commit policy

Git is a **model-driven tool call**, not something the orchestrator does behind the model's back.
Every git tool is host-side (the root sandbox ships no git) and every one of them runs through
`runGit` — an explicit `-C <projectPath>` with an argv and **no shell**, so nothing can escape the
project repo. The model never gets the in-app slash-commands; it gets tools that do the same job with
guardrails.

- `list_changes()` — every uncommitted path in the project repo, with its status code. Paths only,
  never a diff, so a large working tree can't quietly consume `num_ctx`.
- `commit_changes(paths, intent)` — stages **exactly** the paths named (never `git add -A`) and
  commits them. The caller does **not** write the message: `composeCommitMessage` hands the real diff
  of those paths to a **throwaway one-shot context** which writes it, so a phase that misdescribes its
  own change cannot talk the log into agreeing, and the message costs the calling phase no context.
  Any path escaping the project repo is refused — the guard that keeps a [rules/](../rules/) edit from
  ever being committed by a model.
- `git_inspect(what, ref?, paths?, count?)` — read-only history: `diff`, `log`, `show`. **Bounded**:
  `diff`/`show` truncate head+tail at `REVIEW_DIFF_BUDGET`, and `log` is capped at 100 commits
  (default 20). The model can narrow those limits, never raise them.
- `git_stash(action, label?)` — `save` / `list` / `pop` / `drop`, addressed by a label the model
  chooses, never by `stash@{n}` (an index shifts the moment anything else is stashed). Labels live
  under `lad-shelf:`, **disjoint from the task loop's own `lad-stash:<taskId>`** records, so a model
  can never pop or drop the stashed failed attempt that Retro reads and the user reviews. A label may
  not contain a colon, so the prefix cannot be forged.
- `git_branch(action, name?)` — `create` / `switch` / `list`. Nothing deletes a branch. `create` on a
  branch that already exists **switches to it** and reports `existed: true`, so a re-run or a later
  fix round costs no wasted turn. A dirty working tree is treated differently by the two: `create` is
  allowed (`checkout -b` carries the work across intact), `switch` to an existing branch is **refused**
  with a recoverable message, so work never rides onto a branch it doesn't belong to.
- `git_push()` — **no arguments**: always the checked-out branch, always `origin`, always `-u`, never
  a force. A branch missing on the remote **is created by the push**; a missing **repository is an
  error** — the model never creates one, so it fails with a recoverable message and the user creates
  the repo.

### One task, one branch

Every task is developed on its own branch, `task/<id>-<title-slug>` — derived mechanically from the
backlog (`taskBranchName`), where the title slug is dropped when the id's own leaf already ends with
it. **The Worker creates it**, as its first action: it is the first actor on a task, and its seed
message names the exact string, so nothing downstream has to guess. Create-or-switch makes repeating
the call harmless across the fix loop, an escalation, or a re-run. The Reviewer then commits onto the
branch it finds.

**Nothing merges a task branch back.** Finished work reaches the main branch when the **user** merges
it; the model can push a branch, and that is where its authority ends.

Planning output is not a task: Discovery/Design/Breakdown commit on the branch that is checked out and
do not branch for their own work. No phase branches or pushes unless the user asked for it.

Who may commit:

- **Every phase except the Worker.** The planning phases commit their approved output at each
  approval point.
- **The Worker never commits.** `commit_changes` is stripped from its tool definitions *and* refused
  in its window, because a Worker that commits its own code is its own gatekeeper. It leaves work in
  the working tree and hands everything to the Reviewer.
- **The Reviewer is the committing authority for execution work**, and may commit **partially**: it
  commits the files it accepts and leaves the rest. It still has no `write_file`/`edit_file` — it can
  commit the Worker's code but never edit it.

The verdict is then checked against the real repo (`verdictGitConflict`) and rejected — with one
re-prompt — if they disagree:

| Rule | Why |
|---|---|
| A `pass` may leave **nothing** uncommitted | The Reviewer commits what it accepts, so anything left is by definition not accepted; passing would silently drop it. |
| A `pass` requires the task marked done | `mark_task_done` (a Reviewer-only tool, not in the registry) flips the backlog file; the Reviewer then commits it, so a closed task is always recorded in git. |
| A `fail` must name **every** uncommitted file in an issue | Every file left behind goes back to the Worker; none of them may arrive without a reason. |

A `fail` on a **clean** tree is legal and normal: everything the Worker wrote was worth keeping, but
the task still needs work that doesn't exist yet.

Because acceptance is partial, an **escalated or blocked task can still have landed commits** — the
run/batch reports say what was accepted, and only what never passed is left in the tree (and stashed).

- **Global instruction edits are the exception — never auto-committed.** When the Retro phase (or
  anything) edits a global phase file under [rules/](../rules/), it leaves the change **uncommitted**
  and **warns the user that the change must be reviewed before continuing**; the user commits it
  manually. The orchestrator's own instruction set must never mutate silently.
