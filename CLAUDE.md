# CLAUDE.md

Guidance for Claude Code when working in this repo. This file is for you (Claude Code) as an advisor helping the user build the orchestrator. It is **not** consumed by the local Ollama model — that model gets its instructions from [rules/](rules/).

## Prime directive: do not assume, ask

This project's requirements live mostly in the user's head. When a task is ambiguous, **ask clarifying questions instead of guessing**. Even small decisions (tool signatures, file layout, naming, what a phase means) should be confirmed if not already documented here or obvious from the code.

Corollary: if you learn a new product requirement during a conversation, propose adding it to this file.

## What this project is

A Python CLI that orchestrates a **locally-run** Ollama model to autonomously develop code projects. The user's goals:

- Learn prompt engineering, AI interaction isolation, and planning by building the orchestrator themselves.
- Practice planning skills by driving the interactive planning phases and reviewing execution output.
- Run everything on a local RTX 3060 — no cloud spend.
- Ship this repo as a public learning artifact, used only by the author.

### Non-goals

- Not a VSCode/Cursor replacement.
- Not a "vibe coding" tool.
- No backend/frontend deployment for the orchestrator itself.
- No multi-user support.
- No cross-platform support yet (Windows-first until it works flawlessly).
- **No parallelism.** Phases run **one at a time**, sequentially. The intended way to scale is to start a batch and let it run unattended (e.g. overnight), not to run windows concurrently. (A 3060's VRAM wouldn't comfortably hold parallel slots anyway.)

## Core mental model: one model, many context windows

There is exactly **one** local Ollama model. Everything else is context windows.

- Ollama's chat API is **stateless**. The model knows only what is in the `messages` array you send it on a given call — there is no hidden server-side memory. "Memory" = the orchestrator replaying the accumulated history every call (`LLMProvider.chat`/`stream` in [core/llm/provider.py](core/llm/provider.py)). `num_ctx` (`OLLAMA_NUM_CTX`) is a hard token ceiling; exceed it and Ollama silently drops the oldest tokens.
- A **"subagent" is not a new model** — it is a fresh, empty `messages` array with a one-shot system prompt + a single task, run against the same Ollama, then discarded. Isolation is just a separate list.
- A **phase** is the unit of work and the unit of instruction. Each phase has an instruction set (its markdown under [rules/](rules/)) that configures the window it runs in. Elsewhere these are called "skills" or "personas" — in this project the single word is **phase**.

So the design is not "personas vs. skills." It is: **which phases the user drives interactively, and which the orchestrator spawns automatically.**

## How a session works

`.\run.ps1 start <project-name>` boots the orchestrator locked to one project. Switching projects requires restarting `main.py`. All planning artifacts a project produces live **inside the project repo**, not in the orchestrator repo — each project carries its own agent files.

Work is organized into **phases**. A phase is an instruction set loaded into a context window. The planning phases are interactive (the user drives them); the execution phases are spawned automatically once the user triggers them.

### Planning phases (interactive — the user drives, loops freely)

The user is questioned about every detail; the output documents what to build, what *not* to build, and what is deferred to v2/v3. A seed "idea" is almost always a bundle of features, so planning decomposes it through a Scrum-style hierarchy: **Idea → Epics → Stories → Tasks.**

| Phase | Produces | Notes |
|---|---|---|
| **Discovery** | Requirements + versioned scope, and the list of features with their interactions, grouped into one or more **Epics** | Interviews the user. Thinking about feature interactions up front is what makes an epic coherent. |
| **Design** | Splits an epic into **Stories** (and the architecture/boundaries that hold them together) | Iterates **together with** Breakdown — design and decomposition inform each other. |
| **Breakdown** | Splits stories into the ordered, prioritized **Task** list the execution loop consumes | Works **per-story** to balance richer context against the `num_ctx` limit. Holds the Product Owner + Sequencer responsibilities; split it back into separate phases if it grows two distinct jobs. |

These phases are **non-linear** — the user can loop back (Discovery ⇄ Design ⇄ Breakdown) to revise scope, re-architect, or re-sequence at any time before triggering execution.

### Execution phases (automatic — the user triggers, then it runs)

The user starts execution explicitly and chooses the batch: **one task, some tasks, or all tasks** (then walks away — see no-parallelism note; tasks run sequentially). For each task the orchestrator spawns fresh windows and runs:

```
implement → test → review → fix → (loop, max 5 rounds)
```

- **Worker** — a fresh window with the task definition; writes failing tests first, then implements, then runs the tests. **The same Worker window does the fixes** — its history accumulates every prior attempt plus the Reviewer's feedback, so it should converge in as few rounds as possible rather than starting blind each time.
- **Reviewer** — a separate fresh window that judges the Worker's output against the task definition.
- **Loop control:**
  - Hard cap of **5** implement→fix rounds per task. If the work still hasn't passed review after 5 rounds, the loop stops and **escalates to the user**.
  - **Only the Reviewer can call `raise_blocker(question)`.** The Worker cannot — making the Reviewer the sole gatekeeper is deliberate (a local model is more often confidently-wrong than self-aware, so self-reported confusion from the Worker isn't trustworthy).
  - The Reviewer calls `raise_blocker` **immediately** when it hits genuine confusion — an ambiguous, under-specified, or self-contradictory task definition. The loop halts at once and surfaces the question to the user; nothing proceeds until the user answers.

### Retro phase (automatic — fires after the user resolves a blocker)

When the user answers a blocker, the orchestrator spawns a **Retro** window with `{the task, the misunderstanding, the user's answer}`. It diagnoses *what* went wrong and *where*, then patches the correct file so the mistake does not recur:

- **Systemic** — something that *should* have been caught during Discovery/Design/Review → edit the **global** phase instruction file under [rules/](rules/).
- **Task-specific** — a one-off gap in this task's definition → edit the **project** doc only.

### Git / commit policy

- **Phases auto-commit their approved changes to the project repo.** Approval points: a planning phase's output when the user accepts it and moves on; a Worker's code when the Reviewer passes it. This requires a commit tool (the old "no commit tools yet" rule is superseded for project repos). Branch tooling is still not needed.
- **Global instruction edits are the exception — never auto-committed.** When the Retro phase (or anything) edits a global phase file under [rules/](rules/), it leaves the change **uncommitted** and **warns the user that the change must be reviewed before continuing**, then the user commits it manually. The orchestrator's own instruction set must never mutate silently.

### Inter-phase communication: `AGENT_NOTES.md`

Because each window has its **own isolated history** and never sees another phase's turns, cross-phase signals need a file on disk. The convention is a shared file in the **project repo root** (sibling of `PRODUCT_SPEC.md`):

```
# Agent Notes

## To: Discovery
## To: Design
## To: Breakdown
## To: Worker
## To: Reviewer
```

Each section is that phase's inbox. Protocol:
- **Phase start:** the active phase reads its own `## To: <Phase>` section and addresses every `[OPEN]` item before starting new work.
- **During a phase:** when a phase spots a concern that belongs to another phase, it appends `- [OPEN] YYYY-MM-DD <phase>: <concise description>` to that phase's section.
- **Resolution:** flip `[OPEN]` → `[RESOLVED]` with a one-line note. Never edit another phase's open items except to mark them resolved.

Whether the orchestrator auto-creates this file on session start or Discovery creates it is still open (see below).

## Memory model

Each phase has its **own isolated message history**. Switching phases saves the active history and loads the target's — no cross-phase leakage, no auto-clear. The user owns the decision to wipe history. Spawned execution windows (Worker/Reviewer/Retro) start from an **empty** history and are discarded after their task — except the Worker, whose history persists *across the fix loop* (so it remembers prior attempts and Reviewer feedback) and is then discarded when the task closes.

- **Manual clear:** `/clear` wipes only the active phase's history.
- **Token-threshold failsafe:** when a phase's history crosses a configured token threshold, the orchestrator summarizes the oldest turns and replaces them with a single summary entry. This is a safety valve against VRAM exhaustion, not normal operation.
- **Per-project persistence:** each project keeps its own per-phase memory so the model always knows where it stopped. Persistence lives with the project repo.
- **Documentation files** (rules, plans, specs) exist for one-time reference or human reading — not loaded into every prompt.

Minimize persistent context to save tokens (local inference is VRAM-bound). Cross-phase communication goes through `AGENT_NOTES.md`, not memory.

**Token counts are always exact.** Read them from Ollama's response (`prompt_eval_count`, `eval_count`) and propagate that exact value through any code that needs it (status line, summarization trigger, audit log, /resume summaries). Never substitute a length-based estimate — estimates drift and they're the wrong basis for VRAM-safety decisions. If a metric isn't returned for a call, surface that explicitly; don't paper over it with a guess.

## Rules loading

Rules are all Markdown, under [rules/](rules/), and are **global** (projects are agnostic to the orchestrator and do not override rules).

Two folders:
- **Phases** ([rules/phases/](rules/phases/)): the phase instruction sets, injected automatically when a phase is loaded. A file contains the phase definition *and* the workflow it owns. The six files are `discovery.md`, `design.md`, `breakdown.md`, `worker.md`, `reviewer.md`, `retro.md`.
- **Standards** ([rules/standards/](rules/standards/)): loaded on demand via tool call. Intended to grow freely.

### Retrieval: LLM-delegated search

To keep the main context lean, the standards catalog is **not** in the system prompt. Two tools:

1. `search_rules(intent: str)` — the model describes what it needs. The orchestrator spawns a **fresh, throwaway LLM context** (not added to session memory) that receives the full `{name, description}` catalog plus the intent, and returns the matching rule name(s). The main context never sees the catalog.
2. `load_rule(name: str)` — returns the full markdown content of the named rule. The model calls this after `search_rules` resolves.

This splits the cost: search-time context holds the catalog once per call and is discarded; main context only holds the file the model actually chose to load.

The phase files (written for the new model — Breakdown merges the old Product Owner + Sequencer; Reviewer covers both behavior **and** standards/conventions):
- [rules/phases/discovery.md](rules/phases/discovery.md)
- [rules/phases/design.md](rules/phases/design.md)
- [rules/phases/breakdown.md](rules/phases/breakdown.md)
- [rules/phases/worker.md](rules/phases/worker.md)
- [rules/phases/reviewer.md](rules/phases/reviewer.md)
- [rules/phases/retro.md](rules/phases/retro.md)

Standards:
- [rules/standards/clean_architecture.md](rules/standards/clean_architecture.md)
- [rules/standards/hexagonal_ddd_manifesto.md](rules/standards/hexagonal_ddd_manifesto.md)

## Sandboxing & tools

Two-tier Docker model. **Hard rule: the model touches only Docker, never the host filesystem.** Every command it runs and every file it edits happens inside a container; the orchestrator is the only host-side process.

- **Root sandbox** ([docker-compose.yml](docker-compose.yml)): one long-lived container named `ai_sandbox` based on `debian:stable-slim`, `network_mode: none`, with `./projects` mounted at `/workspace`. This is what `execute_command` targets. It runs **plain shell commands** (file operations, navigation, piping) without giving the model host access.
- **Per-project sandbox**: each project folder carries its own `docker-compose.yml` for language-specific runtimes (Python, Node, Rust, etc.). The execution loop's **test/build steps need a real toolchain**, so they run against the project's own container, not the root sandbox (which only has bash). The tooling to dispatch commands into the project container is **not implemented yet** — that is the missing piece blocking the execution loop, *not* a host-access question. The exact mechanism is still open (see below), but the constraint is firm: it runs in Docker, never on the host.

Other ground rules:

- The local Ollama model runs on GPU/VRAM on the host (Docker is CPU-focused and cannot host it).
- Tools run **autonomously** (no confirmation prompts). Every tool call must be **logged** for later audit.
- The tool set is grown **on demand** — add tools when the model demonstrably needs one, not preemptively. Current tools live in [tools/](tools/): `list_files`, `execute_command`.

## Code conventions (for the orchestrator itself)

- Python, latest LTS, `pip` with [requirements.txt](requirements.txt).
- `snake_case`, type hints, Python best practices. Never use `typing.Any` — prefer concrete types, `Protocol`, `TypedDict`, or a localized `# type: ignore` when the real type is genuinely unknown.
- Prioritize **user experience** in the terminal interface (Rich).
- **The orchestrator codebase does not require tests.** Test-first is a rule for the project-building phases (the Worker in particular) — it lives in the phase prompts under [rules/](rules/), not in Claude Code's own workflow on this repo.
- Do not assume — if a design choice isn't covered here or in the code, ask the user.

## Repo layout (current, in-progress restructure)

```
local-ai-developer/
├── main.py                 # CLI entry; owns the REPL loop
├── core/
│   ├── session/            # orchestrator, memory, state, manager
│   ├── container/          # Docker client
│   ├── llm/                # Ollama provider
│   └── ui/                 # Rich renderer + theme
├── agents/                 # phase classes (base, factory)
├── context/                # prompt/context builders, rules loader
├── interface/              # terminal loop
├── tools/                  # actions — each file is a tool (model-callable), a command (user-callable via `/name`), or both
├── rules/
│   ├── phases/             # phase instruction sets (markdown) — physically still `personas/`, rename pending
│   └── standards/          # on-demand reference rules (markdown)
├── projects/               # each child is its own git repo, developed by the model
├── docker-compose.yml
└── run.ps1                 # install / start / stop
```

The [README.md](README.md) is being rewritten by the user to match this phase-based model — do not edit it without being asked; validate it when requested.

## Commands (as of today)

Host:
- `.\run.ps1 install` — install everything
- `.\run.ps1 start <project-name>` — start session for a project
- `.\run.ps1 stop` — shut down Docker

In-app (Rich terminal):
- `/swap <phase>` — switch active phase
- `/exit` — quit
- (README also lists `/switch`, `/clear`, `/models list`, `/models pull` — [main.py](main.py) currently only implements `/swap` and `/exit`. Confirm with the user before relying on the others.)

## Environment

- [.env.example](.env.example) currently only sets `OLLAMA_NUM_CTX`. Model name and active phase will eventually move to the UI, not `.env`.

## Open questions / not yet decided

Track these here as they come up so future-you knows what's still fuzzy:

- **Persona→phase code sweep:** the phase *files* are renamed and rewritten, but internal Python identifiers still say "persona"/"role" (`Agent.persona`, `SessionMemory` persona naming, `ToolAuditLogger` persona arg, `ui.set_persona`, the `persona` local in `main.py`, `initial_role`). A mechanical rename pass is still pending — it's cosmetic, the app runs as-is.
- **Project-runtime dispatch mechanism:** *that* it runs in Docker is decided; *how* is not. Options: (1) give `ai_sandbox` a Docker socket so it can `docker compose run` into the project's container; (2) have `execute_command` detect "needs project runtime" and call the project's compose; (3) a dedicated `run_in_project(command)` tool.
- **`execute_command` workdir scoping:** today it runs from `/workspace`, so a phase on project A could `cd` into project B. Needs confining to the active project's workdir.
- **Phase-file rename + rewrite:** rename `rules/personas/` → `rules/phases/`, rewrite the 7 old persona drafts into the 6 phase files above (merging PO+Sequencer → Breakdown; folding/deciding Standards Reviewer into Reviewer; writing a new Retro), and remove "persona"/"role" naming across the Python code (`agents/`, `core/session/`, `tools/swap.py`, etc.) and `AgentFactory._personas_dir`.
- **Task backlog format/location:** where the ordered Task list (with per-task status) and the Epic→Story→Task hierarchy live inside the project repo, and in what format.
- Memory summarization trigger thresholds and who decides (orchestrator heuristic vs. model self-report).
- Where `PRODUCT_SPEC.md`, `AGENT_NOTES.md`, and any per-project memory file live inside each project repo (filename, folder).
- Which LLM (and which context size) powers the `search_rules` throwaway context — same local model, or a smaller/faster one?
- Whether the orchestrator should auto-initialize `AGENT_NOTES.md` on session start, or leave creation to the Discovery phase.
