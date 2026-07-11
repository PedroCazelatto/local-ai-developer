# Roadmap

Forward-looking plan for the orchestrator. Pairs with [CLAUDE.md](CLAUDE.md), which
describes *intent*; this file describes *goals, order of work, and the task backlog* toward v1.0
and beyond.

Detailed, executable acceptance criteria for each item live in [tasks/](tasks/), grouped by
version. Each task file follows the template in [tasks/README.md](tasks/README.md).

---

## The pivot (2026-06-21)

Two load-bearing decisions reshape the whole plan. They override the older Python/air-gapped
assumptions still lingering in some docs:

1. **Language: TypeScript / Node.** The Python implementation proved too heavy to keep building
   on. The orchestrator is being rewritten in **TypeScript on Node**. The existing Python code is
   **reference only** — it is read to recover behavior and acceptance criteria, never treated as
   the source of truth, and is **deleted once the TS build reaches parity.**
2. **Sandbox: controlled internet.** Every project needs live package installs (`npm i`,
   `pip install`, `cargo fetch`). The sandbox therefore gets **network access**, hardened per the
   dockerode model: rootless user, CPU/RAM caps, short-lived/disposable containers, and **only the
   active project mounted**. This reverses the previous `network_mode: none` hard rule.

What does **not** change: one local Ollama model on an RTX 3060, no cloud spend, **no
parallelism** (phases run one at a time; scale by running a batch unattended), the model touches
**only Docker — never the host**, Windows-first, single-user, shipped as a public learning
artifact.

---

## Goals

**Primary:** Learn prompt engineering, context-window isolation, and planning *by building the
orchestrator myself* — **and actually use it** to develop real projects on local hardware. The
older roadmap was almost entirely internal plumbing; this one is reorganized so the shortest path
reaches a loop I would actually run.

**Standing constraints**

- One local Ollama model, RTX 3060, zero cloud spend.
- Sequential phases only — no parallel windows (a 3060's VRAM can't hold parallel slots; the
  intended way to scale is a batch left running overnight).
- The model acts **only inside Docker**, with controlled internet, never on the host filesystem.
- TypeScript / Node + a terminal UI (persistent REPL + clack-style prompts). Windows-first.
- Single-user. Public learning artifact, used by the author.

**Non-goals (unchanged)**

- Not a VSCode/Cursor replacement. Not a "vibe coding" tool.
- No backend/frontend deployment of the orchestrator itself.
- No multi-user support. No cross-platform support yet.

---

## Success criteria per version

| Version | "Done" means… |
|---|---|
| **Foundation** | `run` boots a TS/Node REPL locked to one project, streams an Ollama turn with **exact** token counts, switches phases with isolated histories, and dispatches a model tool call into a hardened, networked Docker sandbox. |
| **V1** | I can take an idea through the planning phases to an ordered Task list, trigger execution, and the local model (Worker) writes failing tests → implements → runs them with real `npm i` inside the project's container. Every tool call is logged. **I** review and git-commit the result. |
| **V2** | After the Worker runs, an automated **Reviewer** judges the output against the task and surfaces a verdict + feedback. Approved work is auto-committed when I accept it. |
| **V3** | The loop closes itself: implement→test→review→fix (max 5 rounds), `raise_blocker` escalation, **Retro** patches the right file, cross-phase inbox carries signals. I can start an all-tasks batch and walk away. |
| **V4** | Any phase pulls a standard on demand (`search_rules`/`load_rule`) without bloating its prompt; every phase's memory persists across restarts with `/clear`/`/resume` and a token-threshold summarization failsafe. |
| **V5** | Sub-agents, model picker in the UI, a polished status line + `/help`, an events log + cost visibility, and a rewritten README — shareable as a learning artifact. |

---

## Version ladder

### Foundation — the TypeScript rewrite skeleton

> Unavoidable prerequisite: nothing runs until the TS skeleton exists. This replaces `main.py`,
> `run.ps1`, and the `core/`/`agents/`/`interface/` Python modules with their TS equivalents.

Scope:

- Node/TS project: `package.json`, strict `tsconfig`, source tree, build/run scripts replacing the
  `run.ps1` verbs (`install` / `start <project>` / `stop`).
- Ollama JS client: `chat` + `stream` + **tool-calling**, `num_ctx` option, and **exact** token
  counts read from `prompt_eval_count` / `eval_count` (never estimated).
- Docker sandbox layer via **dockerode**: a persistent root sandbox container, **networked +
  hardened** (rootless `node` user, CPU/RAM caps), mounting **only the active project** at
  `/workspace`.
- Persistent-REPL UI: streaming output that preserves scrollback, a status line (project · phase ·
  model · tokens · num_ctx), command input, with clack/chalk/ora for discrete prompts, styling, and
  spinners.
- Phase + orchestrator core: a **phase** abstraction (replaces "persona"/"role" entirely — no
  legacy naming in the TS code), per-phase **isolated** message history, phase switching, and the
  tool-dispatch turn loop (the port of `_run_turn` / `_process_message`'s bounded round loop).

Exit criteria: `run start hello-world` opens the REPL, streams one Ollama turn with a real token
count in the status line, `/swap` switches phases without leakage, and a model-issued `read_file`
executes inside the sandbox.

Tasks: [foundation/01](tasks/foundation/01-repo-skeleton-and-toolchain.md) ·
[02](tasks/foundation/02-config-and-session-bootstrap.md) ·
[03](tasks/foundation/03-ollama-client.md) ·
[04](tasks/foundation/04-docker-sandbox-layer.md) ·
[05](tasks/foundation/05-repl-ui-baseline.md) ·
[06](tasks/foundation/06-phase-and-orchestrator-core.md).

---

### V1 — The usable loop *(you are the reviewer / git-gate)*

Goal: drive **idea → Epics → Stories → Tasks**, then run a Worker that writes and verifies code in
a real, networked container. You review and commit; no automated Reviewer yet.

Scope:

- Phase-instruction loader: inject `rules/phases/<phase>.md` as the system prompt on phase load.
- Tool registry + dispatch: discover tools, send their definitions to the model, dispatch calls,
  feed results back, surface structured (recoverable) errors.
- Core file tools: `list_files`, `read_file`, `write_file`, `edit_file`, `search_in_files`, scoped
  to `/workspace` inside the sandbox.
- `execute_command`: plain shell in the root sandbox at `/workspace`, workdir-scoped, recoverable
  error on traversal attempts.
- `run_in_project`: language-specific commands (`npm i`, `pytest`, `cargo build`) in the project's
  **own networked container**, with timeout, captured stdout/stderr, and auto-build.
- Tool-call audit log: append one JSON line per call to `.orchestrator/tool_audit.jsonl`.
- `/new-project <name> <stack>`: scaffold a project with a **networked** hardened `runner` service,
  the `.orchestrator/` skeleton, `PRODUCT_SPEC.md`, and `git init`.
- Planning-phase content: write Discovery / Design / Breakdown so they decompose to the backlog.
- Task-backlog format: settle where/how the Epic→Story→Task list and per-task status live in the
  project repo, and the shape the Worker consumes.
- Worker phase + execution trigger: pick **one / some / all** tasks, run them **sequentially**, a
  fresh Worker window per task (test-first), output left for the user to review and commit.

Exit criteria: from a fresh `/new-project`, the planning phases produce a Task list, you trigger
one task, and the Worker writes failing tests → implements → runs them green via `run_in_project`
with a real dependency install — all tool calls in the audit log.

Tasks: [v1/01](tasks/v1/01-phase-instruction-loader.md) ·
[02](tasks/v1/02-tool-registry-and-dispatch.md) ·
[03](tasks/v1/03-core-file-tools.md) ·
[04](tasks/v1/04-execute-command-tool.md) ·
[05](tasks/v1/05-run-in-project-tool.md) ·
[06](tasks/v1/06-tool-audit-log.md) ·
[07](tasks/v1/07-project-scaffold-command.md) ·
[08](tasks/v1/08-planning-phases-content.md) ·
[09](tasks/v1/09-task-backlog-format.md) ·
[10](tasks/v1/10-worker-phase-and-execution-trigger.md).

---

### V2 — Automated Reviewer

Goal: a single automated review pass closes the gap between "Worker wrote something" and "I trust
it enough to commit."

Scope:

- Reviewer phase: a fresh window that judges Worker output against the task definition; structured
  verdict (`pass` / `fail` + concrete feedback).
- Review integration: after the Worker finishes, spawn the Reviewer, surface the verdict; the user
  still drives any fixes (the automatic fix loop is V3).
- Auto-commit on accept: a commit tool + phase auto-commit policy — approved Worker output is
  committed to the project repo when the user accepts. Global rule edits are **never** auto-committed.

Exit criteria: run a task, see the Reviewer's verdict and feedback, accept, and find the work
committed to the project's git history.

Tasks: [v2/01](tasks/v2/01-reviewer-phase.md) ·
[02](tasks/v2/02-review-integration.md) ·
[03](tasks/v2/03-auto-commit-on-accept.md).

---

### V3 — Full autonomous loop *(the "run it overnight" milestone)*

Goal: implement→test→review→fix runs without a human in the inner loop; humans are only pulled in
on genuine blockers.

Scope:

- The fix loop: implement→test→review→fix, **max 5 rounds**; the **same Worker window** persists
  across rounds (it remembers prior attempts + Reviewer feedback); escalate to the user after 5.
- `raise_blocker(question)`: **Reviewer-only**; halts the loop immediately on a genuinely
  ambiguous/under-specified/contradictory task and waits for the user's answer.
- Retro phase: after the user resolves a blocker, spawn Retro with `{task, misunderstanding,
  answer}`; patch the **global** rule (left uncommitted + warn the user) or the **project** doc
  (task-specific) so the mistake can't recur.
- Cross-phase inbox: `inbox_post` / `inbox_read` / `inbox_resolve` over append-only JSONL, replacing
  the fragile `AGENT_NOTES.md` markdown mechanism.
- Unattended batch execution: start an all-tasks batch, run sequentially, queue escalations for the
  user without stopping the whole run where avoidable.

Exit criteria: kick off a multi-task batch, leave; come back to committed passing tasks, a tidy
escalation queue for the ambiguous ones, and Retro-applied patches awaiting review.

Tasks: [v3/01](tasks/v3/01-implement-test-review-fix-loop.md) ·
[02](tasks/v3/02-raise-blocker-tool.md) ·
[03](tasks/v3/03-retro-phase.md) ·
[04](tasks/v3/04-cross-phase-inbox.md) ·
[05](tasks/v3/05-unattended-batch-execution.md).

---

### V4 — Knowledge + memory

Goal: phases pull standards on demand, and no session is ever lost to a restart or VRAM ceiling.

Scope:

- Standards catalog: YAML frontmatter (`name`, `description`) on every standards file + a loader
  that fails loudly on missing/duplicate names.
- `search_rules(intent)` / `load_rule(name)`: a throwaway Ollama call resolves intent → standard
  name(s) (catalog lives and dies in that call); `load_rule` returns the chosen body. Main context
  never holds the catalog.
- New standards files: `testing_discipline`, `python_idioms`, `error_handling`,
  `naming_conventions`, `commit_hygiene`, `documentation` (keep each tight).
- Per-phase memory persistence: append-only JSONL per phase, exact token counts, with `/clear`
  (archive active history) and `/resume` (restore one of the last 3 archives, summaries derived from
  JSONL — no LLM call).
- Token-threshold summarization failsafe: when the **exact** `prompt_eval_count` crosses
  `RATIO × num_ctx`, summarize the oldest turns into one `summary` record (originals stay on disk,
  only the in-memory view collapses).

Exit criteria: a Reviewer answers a layering question by `search_rules`→`load_rule`→citing it; kill
and restart mid-session and continue without context loss; a long history compacts via the failsafe
with the next `prompt_eval_count` dropping sharply.

Tasks: [v4/01](tasks/v4/01-standards-catalog-frontmatter.md) ·
[02](tasks/v4/02-search-rules-and-load-rule.md) ·
[03](tasks/v4/03-new-standards-files.md) ·
[04](tasks/v4/04-per-phase-memory-persistence.md) ·
[05](tasks/v4/05-token-threshold-summarization.md).

---

### V5 — Power tools + polish

Goal: the orchestrator is fun to use and shareable.

Scope:

- Sub-agents: `spawn_subagent` / `ask_subagent` / `dismiss_subagent` — fresh-context workers a phase
  spawns for side-tasks; in-memory only; every sub-agent tool call audited with a `subagent_id`; no
  nested sub-agents.
- Model picker in the UI: `/models list | pull <name> | use <name>`, persisted across restarts;
  remove the hardcoded model name.
- Status line + `/help` + discoverability: persistent color-coded active phase, current tool +
  elapsed, sub-agent count, time-since-last-tool-call; `/help` auto-generated from the command
  registry; surface the Shift+Tab phase-cycle hint.
- Events log + cost visibility + error surfacing: orchestrator-level events to
  `.orchestrator/events.jsonl`; exact per-phase/per-sub-agent token totals; every tool returns a
  structured, recoverable error rather than killing the stream.
- README rewrite: replace the stale layout/commands, reflect the TS + networked-sandbox reality,
  link here.

Exit criteria: spawn → critique → follow-up → dismiss a sub-agent (visible only in the audit log);
pull and switch models from the UI; `/help` lists every command; README matches reality.

Tasks: [v5/01](tasks/v5/01-subagent-tools.md) ·
[02](tasks/v5/02-model-picker-ui.md) ·
[03](tasks/v5/03-status-line-and-help.md) ·
[04](tasks/v5/04-events-log-and-cost.md) ·
[05](tasks/v5/05-readme-rewrite.md).

---

## Mapping from the old M1–M7 plan

Nothing was dropped — the old plumbing-first milestones were resequenced around reaching a usable
loop, and re-homed onto the TS + networked-sandbox base.

| Old milestone / task | New home |
|---|---|
| M1 — tools online (01 wire tools, 02 audit, 03 workdir scoping) | Foundation (06) + V1 (02, 04, 06) |
| M5 — runtimes (10 `run_in_project`, 11 scaffold) | V1 (05, 07) — now **networked** |
| M2 — retrieval (05 catalog, 06 search/load, 07 standards) | V4 (01, 02, 03) |
| M3 — inbox (04) | V3 (04) |
| M4 — persistence (08 memory, 09 summarization) | V4 (04, 05) |
| M6 — sub-agents (12) | V5 (01) |
| M7 — polish (13 model picker, 14 UX + README) | V5 (02, 03, 05) |
| Reviewer / fix-loop / blocker / Retro (CLAUDE.md intent) | V2 (all) + V3 (01, 02, 03) |
| Cross-cutting (events, cost, error surfacing) | V5 (04) |

---

## Sequencing principles

1. **Foundation is a gate, not a milestone you skip.** The language switch means nothing works
   until the skeleton exists. Resist starting V1 tasks against the dying Python code.
2. **Each version is demonstrable on a real project**, not a unit test — a live `run start` session.
3. **Shortest path to a usable loop first.** V1 deliberately stops at "Worker writes, you review."
4. **Never approximate token counts.** Every metric that touches tokens reads exact values from
   Ollama's response. See [CLAUDE.md](CLAUDE.md).
5. **Just-in-time breakdown for far versions.** Foundation and V1 tasks are written to be executable
   cold; V2–V5 tasks are solid but expect refinement when you actually reach them.

---

## Open questions (carried forward / newly opened by the pivot)

- **Build/run tooling:** `tsc` vs `tsx`/`esbuild` for dev runs; does `run.ps1` survive as a thin
  wrapper that calls `node`, or is it replaced by `npm` scripts? (Foundation/01 decides.)
- **Sandbox container lifecycle:** persistent root sandbox (recommended — `node_modules` survives)
  vs. the ephemeral `--rm`-per-command pattern from the dockerode note (re-installs every call).
- **How hard to cap the network:** open egress vs. an allowlist/proxy for package registries only.
- **Task-backlog format/location** inside the project repo (resolved in V1/09).
- **Where `PRODUCT_SPEC.md` / inbox / per-phase memory live** under `projects/<name>/.orchestrator/`.
- **Which model powers the `search_rules` / summarization throwaway context** — same local model
  (current lean) or a smaller/faster one.
- **Auto-init of project artifacts** on session start vs. leaving creation to the scaffold / Discovery.
- **Execution isolation via branches + PRs (future).** Today the fix loop works directly on the project
  working tree: a passing task commits to the current branch, and a non-passing task's attempt is
  preserved with `git stash` (V3/05) — kept for Retro to inspect on `/answer`, never reused by the Worker
  (a fresh Worker redoes the task from scratch). This stash approach is a **stopgap**: stashes made
  against one base can conflict once later tasks commit, and there is no clean per-task review surface.
  The intended future model is to run **each task on its own branch and open a PR** (per-task isolation,
  reviewable diffs, trivial revert), which also generalizes to real parallelism if that ever changes.
  Deferred — the stash keeps overnight batches unblocked for now.
