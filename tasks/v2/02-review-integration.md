> **Status:** ⬜ Not started

# 02 — Review integration

**Version:** V2
**Depends on:** V2/01 (Reviewer phase), V1/10 (Worker phase + execution trigger), V1/06 (tool-audit log)
**Blocks:** V2/03 (auto-commit on accept) — the user's accept decision happens here and triggers the commit there.

## Why

V2/01 builds the Reviewer window and its verdict shape, but nothing calls it yet. This task wires
the Reviewer into the **execution flow from V1/10**: after the Worker finishes a task, the
orchestrator spawns the Reviewer, feeds it what it needs, **surfaces the verdict + feedback to the
user in the REPL**, and lets the user **accept** or **send back** for a manual fix. This is what
moves V2 from "the Reviewer can judge" to "review is part of running a task," and it is the step
the V2 exit criterion exercises ("run a task, see the Reviewer's verdict and feedback, accept").

**Single pass only.** After one Reviewer verdict, control returns to the **user** — the
orchestrator does **not** automatically re-spawn the Worker on a `fail`. The automatic
implement→test→review→fix loop (max 5 rounds), `raise_blocker`, and Retro are **V3** — explicitly
out of scope here. "Send back" in V2 means the user re-engages the Worker manually.

## Behavior

New per-task flow inside the V1/10 execution trigger (the loop that runs the chosen batch of
**one / some / all** tasks **sequentially** — no parallelism):

```
for each task in batch (sequentially):
    run Worker (V1/10)            # writes failing tests → implements → runs them
    capture changed-files set + test results
    spawn Reviewer (V2/01) seeded with { task definition, changed files / diff, test results }
    render the verdict + feedback in the REPL
    prompt the user: accept  |  send back (manual)  |  skip
        accept    → V2/03 commits the Worker's output, mark task done, continue to next task
        send back → leave the work uncommitted; user re-engages the Worker manually; task stays open
        skip      → leave uncommitted, move on (task stays open / flagged)
```

**Capturing the changed-files set.** The Reviewer must see exactly what the Worker changed. Capture
it via **git** inside the project repo (the project is a git repo from V1/07 scaffold), because git
is the ground truth for "what changed since the last committed state":

- Before the Worker runs, the working tree is at the last accepted commit (clean, since accept ⇒
  commit and send-back/skip leave it dirty — see the note on a dirty starting tree below).
- After the Worker finishes, derive the changed set from the project container / sandbox:
  `git status --porcelain` for the file list and `git diff` (plus `git diff --staged` and untracked
  files) for the content. Run these through `run_in_project` (or `execute_command` in the root
  sandbox at `/workspace` — both see the project tree; pick one and keep it consistent) so they
  execute **in Docker, never on the host**.
- Pass the Reviewer a **bounded** diff: the list of changed paths always, and the diff body trimmed
  to a token budget (truncate the largest hunks, note the truncation) so a big change can't blow
  past `num_ctx`. The Reviewer can `read_file` / `run_in_project` to inspect anything the trimmed
  diff omitted.

**Test results.** Pass the Worker's last `run_in_project` test invocation result
(command, exit code, stdout/stderr tail) as part of the seed. The Reviewer may re-run tests itself
(V2/01) rather than trust the transcript.

**Surfacing to the user (REPL).** Render the verdict clearly:

- a headline line colored by `result` (e.g. green PASS / red FAIL) plus the `summary`;
- the `issues` as a list grouped by `severity`, each showing `file` + `note`;
- the task id/title and the changed-files count for context.

Then a discrete prompt (clack-style) for **accept / send back / skip**. The chosen action and the
verdict are recorded to the audit/events log so a batch run leaves a reviewable trail.

**Unattended batches.** A user picking "all tasks" then walking away still gets single-pass review
per task, but there's no auto-fix to keep going on a `fail`. For V2, a `fail` with no user present
**pauses that task** (leave uncommitted, do not commit unreviewed work) and the run continues to
the next task only if that's the chosen V2 behavior — confirm the batch-pause-vs-continue choice
with the user when building (the fully unattended queue is V3/05). Default safe behavior: never
commit on a `fail`, and never auto-advance past an unaccepted task without an explicit user policy.

## Files

- `src/phases/orchestrator.ts` (or wherever V1/10's execution trigger lives) — insert the
  spawn-Reviewer → render → prompt step after each Worker run; route accept → V2/03 commit.
- `src/phases/review-integration.ts` *(new, optional)* — assemble the Reviewer seed (task def +
  bounded diff + test results), capture the changed-files set via git, own the truncation budget.
  Keep it separate from the Reviewer phase itself so V2/01 stays a pure judge.
- `src/interface/review-prompt.ts` *(new)* — REPL renderer for the verdict + the accept/send-back/
  skip prompt. Prioritize terminal UX (color by severity, scannable issue list).
- `src/phases/types.ts` — reuse `ReviewVerdict` from V2/01; add the user-decision enum
  (`"accept" | "sendBack" | "skip"`) if a shared type helps. No `any`.

## Notes / pitfalls

- **Single pass — no V3 leakage:** after one verdict, hand control to the user. No automatic
  Worker re-spawn, no round counter, no `raise_blocker`, no Retro. Resist the temptation to "just
  loop once more."
- **Never commit unreviewed/failed work:** only an explicit user **accept** triggers V2/03's
  commit. Send-back and skip leave the tree dirty for the user/Worker to continue.
- **Dirty starting tree:** if the user sent back / skipped a prior task, the next Worker starts on a
  dirty tree, so the "changed since last commit" diff includes the carryover. Decide and document:
  scope the diff to the current task (e.g. the user resolves the carryover first) or surface the
  full dirty diff with a warning. Confirm with the user — don't silently mix two tasks' changes.
- **Diff token budget:** the diff must be bounded against `num_ctx`; truncate with an explicit
  marker and rely on the Reviewer's read tools for the rest. A 5k-line diff cannot go in verbatim.
- **Tokens are exact:** the Reviewer turn's token usage comes from Ollama's `prompt_eval_count` /
  `eval_count`; never estimate. Surface to the status line / audit log.
- **Isolation:** the Reviewer window is fresh and separate from the Worker's (V2/01). This task
  only assembles its seed — it must not pass the Worker's message history.
- **Sandbox boundary:** the git inspection (`git status`/`git diff`) runs **in Docker** against the
  project tree, never on the host. The orchestrator is the only host-side process.
- **Everything logged:** the spawn, the verdict, and the user's decision all append to the
  audit/events log (V1/06) — autonomous, no silent steps.

## Acceptance

Verify by driving a live `run start` session on a real project with at least one ready task:

- Triggering execution for one task runs the Worker, then **automatically** spawns the Reviewer
  with the task definition, the captured changed-files diff, and the test results — confirmed in
  the audit log (Worker run, then Reviewer spawn, then verdict).
- The REPL shows the verdict: a PASS/FAIL headline + summary, and on a fail the issues grouped by
  severity with `file` + `note`. It is readable without horizontal scrolling.
- The user is prompted **accept / send back / skip**. Choosing **accept** hands off to V2/03 and
  the work lands in git history (verified in V2/03). Choosing **send back** or **skip** leaves the
  working tree **uncommitted** (verify `git status` shows the changes still present).
- On a deliberately failing Worker output, the verdict is FAIL, the user is **not** offered a
  silent commit, and no automatic Worker re-spawn occurs (single pass).
- The changed-files set the Reviewer received matches `git status --porcelain` of the project after
  the Worker run (the capture is correct), and the diff fed in is bounded (large diffs show a
  truncation marker, not the full body).
- Every step (spawn, verdict, user decision) is in the audit/events log.
