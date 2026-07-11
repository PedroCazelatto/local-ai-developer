> **Status:** ✅ Completed (2026-07-11)
>
> **As built (user-approved):** commit runs **host-side** (`commitPaths` in
> `src/core/session/project-git.ts`) — orchestrator-fired on the user's accept, never a model tool,
> so it lives in `core/session`, not `src/tools/commit.ts`. Stages the **accepted set only** (never
> `-A`); the guard **refuses any path escaping the project repo** (which covers the orchestrator's
> `rules/`, since that tree is outside the project) with a "review before continuing" error. Message
> built by `src/core/session/commit-message.ts` in the confirmed default convention — no human-name
> trailer. Verified against a throwaway repo (commit, clean-after, escape-guard, empty-set, message).
> Live `run start` acceptance is the user's step.

# 03 — Auto-commit on accept

**Version:** V2
**Depends on:** V2/02 (review integration — the user's "accept" decision triggers this), V1/07 (project scaffold = the project is a git repo), V1/06 (tool-audit log)
**Blocks:** completes V2 — satisfies the exit criterion "accept, and find the work committed to the project's git history."

## Why

V2/02 surfaces the verdict and captures the user's **accept** decision, but nothing writes that
decision to git yet. CLAUDE.md's **Git / commit policy** says phases **auto-commit their approved
changes to the project repo** — for the Worker, the approval point is exactly the user accepting
the reviewed output. This task adds the **commit tool** (the old "no commit tools" rule is
explicitly superseded for project repos) and the **auto-commit-on-accept** policy, closing V2.

The hard counter-rule, also from CLAUDE.md: **global instruction edits under `rules/` are never
auto-committed.** The orchestrator's own instruction set must never mutate silently. (No Retro
phase edits rules in V2 — that's V3 — but the commit tool must still refuse to commit `rules/`
changes from day one so the policy can't be violated later.) Branch tooling is **not needed**.

## Behavior

**A commit tool** — `git add` + `git commit` inside the **project repo**, run in Docker:

```ts
interface CommitArgs {
  message: string;     // full commit message (subject + optional body), see convention below
  paths?: string[];    // project-relative paths to stage; default: the accepted changed-files set from V2/02
}

interface CommitResult {
  committed: boolean;
  sha?: string;        // short SHA on success
  files: string[];     // files actually staged + committed
  error?: string;      // structured, recoverable — set when committed === false
}
```

- Runs `git add <paths>` then `git commit -m <message>` via `run_in_project` (or `execute_command`
  in the root sandbox at `/workspace` — match V2/02's choice) so it executes **in Docker, never on
  the host**.
- Stages **only** the accepted changed-files set passed from V2/02 by default (not a blanket
  `git add -A`), so a dirty carryover from a sent-back task doesn't get swept into this commit.
- Returns a structured `CommitResult`; on failure (nothing staged, git error, refused path) it
  returns `committed: false` + a readable `error` rather than throwing — recoverable like every
  tool, and logged to the audit log (V1/06).

**Auto-commit policy (the wiring):**

- This commit is **not** a model-issued tool call the Worker/Reviewer decides to make. It is fired
  by the **orchestrator** the moment the **user accepts** in V2/02. Worker/Reviewer never get the
  commit tool in their allowlists (the Reviewer is read-mostly per V2/01; the Worker only writes
  code). Keeping the commit host-orchestrated, gated on the user's accept, is what makes
  "auto-commit" safe.
- On accept: commit the accepted set → mark the task done in the backlog (V1/09 format) → continue.
- On send-back / skip (V2/02): **no commit.** The tree stays dirty for the user/Worker.

**Commit-message convention** (decide the exact string when building; this is the proposed default —
confirm with the user):

```
<type>(task <task-id>): <task title>

<Reviewer summary, 1–3 lines>
Reviewed-by: orchestrator (Reviewer phase) — verdict: pass
```

- `<type>` follows Conventional Commits (`feat` / `fix` / `chore` / `test` / `refactor`), chosen
  from the task's nature; default `feat`.
- Subject ≤ ~72 chars; body carries the Reviewer's `summary` so the git log explains *why* it
  passed.
- **No author/co-author trailer naming any human** — the user's name must never be written into
  repo files or commit metadata. Keep the trailer to the orchestrator/phase, not a person.

**Global-rule guard (hard rule).** The commit tool **refuses** to stage or commit any path under
the orchestrator's `rules/` tree (or anything outside the project's `/workspace`). Because the tool
runs against the **project** container/sandbox, the orchestrator's `rules/` directory isn't even
mounted there — but the guard is explicit and tested anyway: if a commit ever targets a `rules/`
path, it returns a structured error and, per CLAUDE.md, the change is **left uncommitted** with a
**REPL warning that the user must review it before continuing**. This keeps V3's Retro phase honest
when it lands.

## Files

- `src/tools/commit.ts` *(new)* — the commit tool: `git add` + `git commit` via the project
  sandbox, the `rules/`-path / out-of-workspace guard, structured `CommitResult`, audit logging.
  No `any`.
- `src/phases/orchestrator.ts` (or the V2/02 review-integration glue) — on user **accept**, build
  the commit message from the task + Reviewer verdict, call the commit tool with the accepted
  changed-files set, then mark the task done. On send-back / skip, do nothing.
- `src/phases/commit-message.ts` *(new, optional)* — assemble the convention-formatted message from
  `{ taskId, taskTitle, type, reviewerSummary }`. Keep formatting in one place.
- `src/phases/types.ts` — `CommitArgs`, `CommitResult` exported alongside `ReviewVerdict`.

## Notes / pitfalls

- **Never auto-commit `rules/`:** the guard is mandatory and must hold even though the project
  container can't see the orchestrator repo. Anything that edits a global rule leaves it
  uncommitted and warns the user (CLAUDE.md). No silent mutation of the orchestrator's own
  instructions, ever.
- **Stage the accepted set, not `-A`:** a blanket add would pull in a dirty carryover from a
  previously sent-back/skipped task. Stage exactly what was reviewed and accepted.
- **No human name in commits:** no `Co-Authored-By` / author trailer naming the user. The trailer
  references the orchestrator/Reviewer phase only.
- **Commit only on explicit accept:** never on a `fail`, never on send-back/skip, never as a
  model-issued call. The orchestrator fires it, gated on the user's decision.
- **In Docker, never the host:** the git commands run in the project container / root sandbox at
  `/workspace`. The orchestrator triggers them but the git operation itself is sandboxed.
- **Recoverable + logged:** a failed commit returns a structured error and is logged; it does not
  crash the execution run. The user can retry / fix and re-accept.
- **No branch tooling:** commit straight to the current branch of the project repo. Branch
  management is explicitly out of scope.

## Acceptance

Verify by driving a live `run start` session on a real project:

- Run a task, get a **pass** verdict (V2/02), choose **accept** → the work is committed: a new
  commit appears in the **project's** `git log` whose message follows the convention (subject with
  `task <id>` + title, body carrying the Reviewer summary, no human-name trailer) and whose
  committed files match exactly the accepted changed-files set.
- After the commit, the project working tree is clean for that task's files (`git status` shows
  them committed, not dirty), and the task is marked done in the backlog.
- Choosing **send back** or **skip** produces **no** commit — the changes remain uncommitted in the
  working tree.
- Attempting (in a scripted check) to commit a path under `rules/` or outside `/workspace` returns a
  structured error, commits nothing, and surfaces the "review before continuing" warning in the
  REPL — confirming global rule edits are never auto-committed.
- A forced git failure (e.g. nothing to commit) returns a structured recoverable error in the audit
  log and does not crash the run.
