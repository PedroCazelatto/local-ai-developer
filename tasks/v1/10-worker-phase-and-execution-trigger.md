> **Status:** ✅ Completed (2026-07-04) — TS committed; rules/phases/worker.md edit left UNCOMMITTED for user review (constitution). Live Worker pass deferred to the final model run.

# 10 — Worker phase + execution trigger

**Version:** V1
**Depends on:** V1/01 (phase prompt loader), V1/02 (tool dispatch), V1/03 (file tools), V1/05 (`run_in_project` for tests/installs), V1/06 (audit), V1/09 (backlog the trigger reads), Foundation/06 (fresh isolated windows).
**Blocks:** the V1 exit criterion — *"the Worker writes failing tests → implements → runs them, and **I** review and git-commit."*

## Why

This is the payoff of V1: turn a backlog task into verified code. Two parts: (a) the **Worker phase markdown** (test-first), and (b) the **execution trigger** — a command/UI to pick **one / some / all** tasks and run them **sequentially**, spawning a **fresh Worker window per task**, leaving the result for the **user to review and git-commit**.

## V1 SCOPE BOUNDARY (state explicitly)

V1 stops at **"Worker writes/tests code, the USER reviews and git-commits."** Explicitly **out of scope for V1**, deferred:
- **No automated Reviewer** (V2).
- **No fix-loop** / implement→test→review→fix rounds, no 5-round cap (V3).
- **No `raise_blocker`** (V3 — Reviewer-only).
- **No Retro** (V3).
- **No auto-commit** (V2 — in V1 the human commits).

The CLAUDE.md execution model (`implement → test → review → fix`, max 5 rounds, Reviewer-only blocker, Retro) describes the **eventual** loop. V1 ships **only the Worker leg of it**, run sequentially, human-reviewed. Don't build the loop machinery now.

## Part A — Worker phase markdown

The Worker window is told (its system prompt, `rules/phases/worker.md` via V1/01): you are given **one task** from the backlog; implement exactly it, test-first.

Workflow the prompt enforces:
1. Read the task description + acceptance criteria (seeded into the window — see Part B).
2. Write **failing tests** that pin the acceptance criteria. Run them via `run_in_project` and confirm they fail for the right reason.
3. Implement the **minimum** code to pass. Write/edit files via `write_file`/`edit_file` (V1/03).
4. Run the suite via `run_in_project` (V1/05) — real toolchain, real `npm i`/`pip install` if needed (networked container).
5. Summarize for the **user**: files touched, tests added, assumptions made, anything surprising.

Align the existing `rules/phases/worker.md` to V1 reality (it currently describes the full V3 fix loop and Reviewer/`AGENT_NOTES.md`):
- **Remove/defer the "fix loop" + Reviewer + 5-round + auto-commit language** — in V1 the Worker runs once per spawn and hands off to the **user** (note these arrive in V2/V3).
- **Tools:** reference the tools that exist — `read_file`, `write_file`, `edit_file`, `list_files`, `search_in_files`, `execute_command`, `run_in_project`. **Drop `search_rules`/`load_rule`** (V4 — not available) and the `AGENT_NOTES.md` section (V3 inbox — soften to "state cross-phase concerns in your summary").
- Keep: test-first discipline, stay-in-scope, **work only inside Docker** (every build/test through `run_in_project`, never the host), and "don't guess silently — state assumptions in the summary" (in V1 there's no Reviewer to catch a wrong read, so the user reads the summary).

## Part B — Execution trigger

A user-driven command/UI that runs backlog tasks. Suggested command: `/run <selector>` where `<selector>` is `next` (the single next runnable task), a task id (`E1-S1-T1`), a comma list, or `all`.

Flow:
1. `readBacklog` (V1/09). Compute eligible tasks via `nextRunnableTasks` (sorted by `order`, `depends_on` satisfied). Resolve the selector to an **ordered list** of task ids.
2. **Sequentially** (no parallelism — CLAUDE.md), for each task in order:
   a. `setTaskStatus(taskId, "in_progress")`.
   b. **Spawn a fresh Worker window** — an empty `messages` array seeded with: the Worker system prompt (V1/01) + a user message carrying the **task definition** (id, title, description, acceptance, depends_on) **plus a relevant slice of `PRODUCT_SPEC.md`** (the owning epic/story context — not the whole spec, to respect `num_ctx`). This window is **fresh and isolated** (Foundation/06) — it does not see other phases' or other tasks' history.
   c. Run the Worker turn loop (tool dispatch V1/02) until the Worker reports done (its summary). All tool calls audited (V1/06), all runs through the project's networked container (V1/05).
   d. **Discard** the Worker window after the task (no cross-task carryover — V1 has no fix loop that would persist it).
   e. **Hand off to the user:** surface the Worker's summary + the files it touched. The user reviews, and **git-commits** the result themselves. The task is marked `done` only after the user confirms (no auto-Reviewer, no auto-commit in V1). If the user rejects, they can re-`/run` the task (fresh window again).
3. For `all`/`some`: after each task's user review, proceed to the next. A task whose `depends_on` aren't `done` is skipped with a clear note (don't run it out of order).

UI: each task shows which one is running (id + title), streams the Worker's output (Foundation/05 REPL), then pauses for the user's review/commit before the next. No walking-away-unattended in V1 (that's the V3 batch milestone) — the human is the gate between tasks.

## Files

- `rules/phases/worker.md` — align to V1 (remove fix-loop/Reviewer/auto-commit/`AGENT_NOTES.md`/`search_rules`; keep test-first + Docker-only). *(This task edits the Worker markdown; V1/08 edited the planning markdowns.)*
- `src/interface/commands/run.ts` — the `/run <selector>` command: resolve selector, iterate sequentially, drive each Worker window, gate on user review.
- `src/core/session/worker-runner.ts` — spawns a fresh Worker window (empty history + Worker system prompt + seeded task message + spec slice), runs the dispatch loop, returns the summary; discards the window.
- `src/core/session/backlog.ts` (V1/09) — `setTaskStatus`, `nextRunnableTasks` used here.

## Notes / pitfalls

- **Fresh window per task, then discarded.** No carryover between tasks (V1 has no persisting fix loop — that's V3). Each Worker starts blind except for its seeded task + spec slice.
- **Sequential only** — never spawn two Workers at once (CLAUDE.md no-parallelism; a 3060 can't hold parallel slots).
- **The human is the reviewer and the git gate in V1.** Don't auto-commit (V2) and don't spawn a Reviewer (V2). Mark `done` only on user confirmation.
- **Seed a *slice* of the spec, not all of it** — `num_ctx` is a hard ceiling; the Worker needs its task + the owning epic/story, not the whole `PRODUCT_SPEC.md`.
- **Everything runs in Docker** — the Worker tests/builds via `run_in_project` (networked project container), never the host. The phase prompt must reinforce this.
- **Tokens exact** — the Worker window's size is tracked via Ollama's `prompt_eval_count`/`eval_count` (CLAUDE.md), never estimated.
- **Status transitions:** trigger sets `in_progress` on spawn; user confirmation sets `done`; unmet dependency → skip (leave `pending`).

## Acceptance

- On a project taken through V1/08 planning to a backlog (V1/09): `/run next` picks the top runnable task, spawns a fresh Worker, and the Worker (via `run_in_project`) writes a **failing** test, implements, re-runs to **green** — with a real dependency install where the task needs one (proves the networked container).
- The Worker's tool calls (write_file, run_in_project build+run, etc.) all appear in `.orchestrator/tool_audit.jsonl` (V1/06).
- After the Worker finishes, the app shows its summary + touched files and **waits** — nothing is committed automatically; the user commits manually, then the task flips to `done`.
- `/run all` runs the eligible tasks **one at a time**, pausing for user review between each; a task with an unmet `depends_on` is skipped with a clear message, not run out of order.
- No Reviewer window, no fix-loop round counter, no `raise_blocker`, no Retro occurs anywhere in the V1 flow.
