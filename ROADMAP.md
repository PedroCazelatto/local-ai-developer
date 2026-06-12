# Roadmap

Forward-looking plan for the orchestrator. Pairs with [CLAUDE.md](CLAUDE.md), which describes intent — this file describes order of work toward v1.0.

Detailed acceptance criteria for each item live in [tasks/](tasks/), numbered in the suggested execution order.

## Where we are today

Working end-to-end:

- REPL loop (`main.py`) with Rich TUI, persona swapping, message queue, input history.
- Per-persona in-memory history, isolated and switched on `/swap`.
- Ollama streaming (`qwen2.5-coder:14b` hardcoded), `num_ctx` from `.env`.
- Root sandbox container `ai_sandbox` reachable via `execute_command`.
- All seven persona markdowns and two standards markdowns present and substantive.
- `ToolFactory` / `CommandFactory` dynamically discover `tools/*.py`; `/swap`, `/clear`, `/exit` wired.

Wired but dormant:

- `Agent.tools` is always `[]` — **the model cannot call any tool yet**. Every other gap is downstream of this.

Missing entirely:

- Memory persistence; token-threshold summarization; `/resume`.
- Inter-persona handoff mechanism (no code reads/writes anything).
- `search_rules` / `load_rule`.
- Per-project runtime (root sandbox has no Python/Node/Rust).
- Tool-call audit log on disk.
- Sub-agent spawning.
- Model selection from the UI.

## Guiding principles for ordering

1. **Unblock the Developer persona first.** It's the only persona whose output is verifiable end-to-end (working code in a project). Until tools work, every other improvement is theoretical.
2. **Each milestone should be demonstrable on `projects/hello-world`** — a real run, not a unit test.
3. **Defer anything that doesn't change what the model can do this week.** Model picker, status-line polish, README rewrite all come after the loop is useful.
4. **Never approximate token counts.** Every metric that touches tokens (status line, summarization trigger, archive summaries, audit log) reads exact values from Ollama's response. See CLAUDE.md.

---

## M1 — Tools online (highest priority)

Goal: a Developer-persona session can read, edit, search, write, and execute commands against `projects/<project>`.

- **Wire `ToolFactory.definitions` to every agent.** `Agent.tools=[]` is the root cause; the model receives no tool definitions today. No per-persona whitelist — every persona gets every tool, and persona markdown is the only place that steers usage.
- **Audit log.** Append every tool call to `projects/<project>/.orchestrator/tool_audit.jsonl` with `{ts, persona, tool, args, exit_status, duration_ms, ...}`. CLAUDE.md explicitly requires this; today only the UI shows it.
- **Workdir scoping.** The sandbox mounts **only the active project** at `/workspace` (`./projects/${ACTIVE_PROJECT}:/workspace`), so other projects and the host are physically unreachable regardless of the command. `execute_command` runs at `/workspace` and additionally returns a clean, recoverable error on `..` traversals so the model self-corrects instead of wandering into the throwaway container OS.
- **Sanity demo.** Run the Developer persona once on `projects/hello-world` and have it create a real file, run a command, see the output.

Exit criteria: model uses at least `read_file`, `write_file`, `execute_command` autonomously in one session.

Tasks: [01](tasks/01-wire-tools-to-agents.md), [02](tasks/02-tool-call-audit-log.md), [03](tasks/03-execute-command-workdir-scoping.md).

---

## M2 — Knowledge retrieval (`search_rules` / `load_rule`)

Goal: any persona can pull in a standard on demand without bloating its system prompt.

- **`search_rules(intent: str) -> list[str]`** — same session model, same `num_ctx`, **fresh API call** (no session history). The catalog of `{name, description}` and the user's intent live and die inside that call.
- **`load_rule(name: str) -> str`** — return the full markdown for the chosen rule.
- **Catalog format.** Each standards file gets short YAML frontmatter (`name:`, `description:`). Loader fails loudly on missing or duplicate names.
- **Six new standards** to give the Standards Reviewer something to work with: `testing_discipline`, `python_idioms`, `error_handling`, `naming_conventions`, `commit_hygiene`, `documentation`. Each one short — the strength of `search_rules` is that the model only loads what it needs.

Exit criteria: Standards Reviewer answers a real review question by calling `search_rules`, then `load_rule`, then citing the rule.

Tasks: [05](tasks/05-standards-catalog-frontmatter.md), [06](tasks/06-search-rules-and-load-rule-tools.md), [07](tasks/07-new-standards-files.md).

---

## M3 — Cross-persona handoff (replaces `AGENT_NOTES.md`)

CLAUDE.md specifies a single shared markdown file with `## To: <Role>` sections. This is fragile for an LLM client (read-modify-write race, formatting drift, no separation between active inbox and resolved history). The roadmap replaces it with a structured inbox driven by three tools.

- **`inbox_post(to: str, body: str)`** — append to the recipient's JSONL.
- **`inbox_read(status: "open" | "all" = "open")`** — returns only the active persona's items.
- **`inbox_resolve(id: str, note: str)`** — append a `resolved` event referencing the original post.

Storage: `projects/<project>/.orchestrator/inbox/<role>.jsonl`, append-only. State is reconstructed by replay.

Exit criteria: Architect raises an item for Developer; Developer reads its open inbox, resolves the item; subsequent `inbox_read("open")` returns empty.

Task: [04](tasks/04-inbox-store-and-tools.md).

---

## M4 — Persistence (`/clear` and `/resume`)

Goal: closing and reopening `main.py` resumes every persona where it left off.

- **Per-persona memory to disk.** Append-only JSONL at `projects/<project>/.orchestrator/memory/<role>.jsonl`. One record per turn, with exact token counts from Ollama.
- **Token-threshold summarization.** When the **exact** `prompt_eval_count` from the previous call crosses `SUMMARIZATION_THRESHOLD_RATIO × num_ctx` (default 0.75), summarize the oldest 50% of turns into one `summary` record that lists every replaced turn id. Original turns stay in the JSONL; only the in-memory view collapses.
- **`/clear`.** Active persona only. Moves the live JSONL into `archive/` under a timestamped+ULID name. No confirmation prompt.
- **`/resume`.** Active persona only. Lists the last 3 archives with a quick summary (timestamp, turn count, total tokens, first and last user message). User picks 1–3 to restore, anything else cancels. Summaries are derived from the JSONL — no LLM call.

Exit criteria: kill `main.py` mid-session, restart, run `/swap developer` and continue without context loss. `/clear` followed by `/resume` returns to the prior state.

Tasks: [08](tasks/08-per-persona-memory-persistence.md), [09](tasks/09-token-threshold-summarization.md).

---

## M5 — Real runtimes (`run_in_project`)

Goal: the model can execute language-specific commands (e.g., `pytest`, `npm test`, `cargo build`) against the active project's own container.

Chosen direction: **host-dispatched `run_in_project` tool** (no docker socket inside `ai_sandbox`, no auto-routing magic).

- **Tool.** `run_in_project(command: str, timeout_s: int = 120)`. Calls `docker compose -f projects/<active>/docker-compose.yml run --rm runner <command>` on the host. Auto-builds the image on first run, then caches.
- **Project scaffold.** `/new-project <name> <stack>` drops `docker-compose.yml`, `Dockerfile` (when needed), `.orchestrator/` skeleton, empty `PRODUCT_SPEC.md`, and runs `git init` once.
- **`execute_command` stays.** Still the right tool for plain shell ops (`ls`, `mv`, `cat`).
- **Audit.** `run_in_project` calls (and the auto-build) go to the same `tool_audit.jsonl`.

Exit criteria: Developer persona runs a failing test, edits a file, re-runs the test, sees it pass — all autonomously.

Tasks: [10](tasks/10-run-in-project-tool.md), [11](tasks/11-project-scaffold-command.md).

---

## M6 — Sub-agents

Goal: any persona can spawn a fresh-context worker for a side-task or a private back-and-forth that shouldn't pollute the main thread.

- **`spawn_subagent(initial_context, task)`** — returns `{id, response}`. Master writes the brief; sub-agent runs in a fresh context with no inherited history.
- **`ask_subagent(id, message)`** — follow-up, can be called many times.
- **`dismiss_subagent(id)`** — drops state. Idempotent.
- **Tool access.** Sub-agents get every tool the master has **except** the three sub-agent tools themselves. No nested sub-agents.
- **Model.** Same session model, same `num_ctx`.
- **Lifecycle.** In-memory only — sub-agents die with the session, not persisted to disk. Their tool calls *are* recorded in `tool_audit.jsonl` with a `subagent_id`.
- **`/subagents`** — list active sub-agents (id, age, message count, exact token total).

Exit criteria: Developer spawns a typing-expert consultant, gets a critique, asks a follow-up, dismisses — all visible in the audit log, none of it in Developer's own memory.

Task: [12](tasks/12-subagent-tools.md).

---

## M7 — Polish toward v1.0

Lower priority, but needed for "this is shareable as a learning artifact":

- **Model picker in the UI.** `/models list | pull <name> | use <name>`. Persist the choice across restarts.
- **Status line.** Active persona persistent and color-coded, current tool with elapsed time, sub-agent count, time-since-last-tool-call. Token values from Ollama only — no estimates.
- **`/help`.** Auto-generated from `CommandFactory`.
- **Shift+Tab discoverability.** One-liner in the input panel footer.
- **README rewrite.** Replace the stale `orchestrator/` layout, command list, and project tree. Link to this roadmap.

Tasks: [13](tasks/13-model-picker-ui.md), [14](tasks/14-ux-polish-and-readme.md).

---

## Cross-cutting backlog

Themes that touch multiple milestones:

- **Logging.** Beyond the tool audit log, route orchestrator-level events (persona swap, memory load, summarization fire, sub-agent spawn) to `projects/<project>/.orchestrator/events.jsonl`. Same format, different file.
- **Configuration story.** `.env` only carries `OLLAMA_NUM_CTX`. Decide what stays in `.env` (machine-specific) vs. project config (per-project model overrides if/when needed).
- **Error surfacing.** Today, a tool exception likely kills streaming. Each tool should return a structured error the model can read and recover from. Same for sub-agent failures.
- **Cost visibility.** Total tokens (exact, from Ollama) per persona and per sub-agent per session, surfaced in the status line and in `tool_audit.jsonl`.

## Open design questions

Carried over from CLAUDE.md:

- **Tester persona, or not?** Test-first lives in Developer; regression checks live in Logic Reviewer. Adding a dedicated Tester adds a swap step and another inbox. **Lean: don't add it until you hit a session where you wished you had it.**
- **Per-project state location.** Proposal: everything orchestrator-owned under `projects/<name>/.orchestrator/` so it's easy to `.gitignore` from the project itself.
- **Inbox guard against posting to your own role.** Edge case; blocking it is overhead. Leave open.
- **Project switch UX.** Today, switching projects requires restarting `main.py`. Worth a `/project switch` command, or keep the one-process-per-project model?

---

## Suggested sequencing

| Order | Milestone | Why now |
|------:|:----------|:--------|
| 1 | M1 (tools online) | Nothing else is verifiable without it. |
| 2 | M3 (inbox) | Lets you drive a multi-persona run on `hello-world`. |
| 3 | M2 (retrieval) | Standards Reviewer becomes meaningful. |
| 4 | M4 (persistence) | Sessions get long enough that losing them hurts. |
| 5 | M5 (runtime) | Required before Developer can self-verify with real test suites. |
| 6 | M6 (sub-agents) | Adds a power tool once the foundation is solid. |
| 7 | M7 (polish) | Only after the loop is fun to use. |
