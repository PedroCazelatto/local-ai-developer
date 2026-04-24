# CLAUDE.md

Guidance for Claude Code when working in this repo. This file is for you (Claude Code) as an advisor helping the user build the orchestrator. It is **not** consumed by the local Ollama model — that model gets its instructions from [rules/](rules/).

## Prime directive: do not assume, ask

This project's requirements live mostly in the user's head. When a task is ambiguous, **ask clarifying questions instead of guessing**. Even small decisions (tool signatures, file layout, naming, what a phase means) should be confirmed if not already documented here or obvious from the code.

Corollary: if you learn a new product requirement during a conversation, propose adding it to this file.

## What this project is

A Python CLI that orchestrates a **locally-run** Ollama model to autonomously develop code projects. The user's goals:

- Learn prompt engineering, AI interaction isolation, and planning by building the orchestrator themselves.
- Practice planning skills by driving the architect persona and reviewing phases.
- Run everything on a local RTX 3060 — no cloud spend.
- Ship this repo as a public learning artifact, used only by the author.

### Non-goals

- Not a VSCode/Cursor replacement.
- Not a "vibe coding" tool.
- No backend/frontend deployment for the orchestrator itself.
- No multi-user support.
- No cross-platform support yet (Windows-first until it works flawlessly).

## How a session works

1. `.\run.ps1 start <project-name>` boots the orchestrator locked to one project. Switching projects requires restarting `main.py`.
2. The user drives planning personas (Explorer, Architect, Product Owner, Sequencer) to produce a written plan. Plans are project-scoped artifacts stored **inside the project repo** (not in the orchestrator repo) — the project carries its own agent files.
3. The plan is sliced into sequenced tasks picked up by the **Developer**; the **Logic Reviewer** verifies behavior and the **Standards Reviewer** verifies convention adherence. Test-first discipline lives inside the Developer persona (failing tests before implementation).
4. The flow is **not linear** — after the reviewers run, the user can loop back to any planning persona to revise the plan, add requirements, or re-sequence before the next Developer phase. Personas are switched manually via `/swap`.
5. The user only interacts while planning and between phases. Within a phase the model runs autonomously with no per-tool confirmation.
6. Each persona keeps its own isolated memory (see Memory model). `/swap` does not clear memory — continuity within a persona is preserved across turns and across swaps.

### Planned personas

- **Explorer** — runs discovery to extract product requirements from the user.
- **Architect** — designs system architecture, boundaries, deployment.
- **Product Owner** — transforms requirements into Epics and User Stories.
- **Sequencer** — orders the backlog into the execution sequence the Developer follows (renamed from Prioritizer — the deliverable is the sequence itself).
- **Developer** — transforms tasks into code, writing failing tests first.
- **Logic Reviewer** — verifies behavior, correctness, and edge cases against the task definition.
- **Standards Reviewer** — verifies convention adherence (architecture, naming, test coverage) using on-demand standards.

The list is open — new personas can be added.

### Inter-persona communication: `AGENT_NOTES.md`

Because each persona has its **own isolated memory** (see Memory model) and never sees another persona's turns, cross-persona signals need a file on disk. The convention is a shared file in the **project repo root** (sibling of `PRODUCT_SPEC.md`):

```
# Agent Notes

## To: Explorer
## To: Architect
## To: Product Owner
## To: Sequencer
## To: Developer
## To: Logic Reviewer
## To: Standards Reviewer
```

Each persona's section acts as its inbox. Protocol:
- **Phase start:** every persona reads its own `## To: <Role>` section and addresses every `[OPEN]` item before starting new work.
- **During a phase:** when a persona spots a concern that belongs to another persona, it appends to that persona's section as `- [OPEN] YYYY-MM-DD <role>: <concise description>`.
- **Resolution:** flip `[OPEN]` → `[RESOLVED]` with a one-line note. Never edit another persona's open items except to mark them resolved.

The Explorer creates the file (with empty sections) during Phase 4 of discovery if it does not already exist. Each persona's file documents the typical signals it raises.

## Memory model

Each persona has its **own isolated message history**. `/swap` saves the active persona's history and loads the target's — no cross-persona leakage, no auto-clear. The user owns the decision to wipe history.

- **Manual clear:** `/clear` wipes only the active persona's history.
- **Token-threshold failsafe:** when a persona's history crosses a configured token threshold, the orchestrator summarizes the oldest turns and replaces them with a single summary entry. This is a safety valve against VRAM exhaustion, not normal operation.
- **Per-project persistence:** each project keeps its own per-persona memory so the model always knows where it stopped. Persistence lives with the project repo.
- **Documentation files** (rules, plans, specs) exist for one-time reference or human reading — not loaded into every prompt.

Minimize persistent context to save tokens (local inference is VRAM-bound). Cross-persona communication goes through `AGENT_NOTES.md`, not memory.

## Rules loading

Rules are all Markdown, under [rules/](rules/), and are **global** (projects are agnostic to the orchestrator and do not override rules).

Two folders only:
- **Personas** ([rules/personas/](rules/personas/)): injected automatically when the active persona is loaded. A persona file contains the role definition *and* the workflows it owns — each workflow belongs to exactly one persona. There is no separate `workflows/` folder.
- **Standards** ([rules/standards/](rules/standards/)): loaded on demand via tool call. Intended to grow freely.

### Retrieval: LLM-delegated search

To keep the main context lean, the standards catalog is **not** in the system prompt. Two tools:

1. `search_rules(intent: str)` — the model describes what it needs. The orchestrator spawns a **fresh, throwaway LLM context** (not added to session memory) that receives the full `{name, description}` catalog plus the intent, and returns the matching rule name(s). The main context never sees the catalog.
2. `load_rule(name: str)` — returns the full markdown content of the named rule. The model calls this after `search_rules` resolves.

This splits the cost: search-time context holds the catalog once per call and is discarded; main context only holds the file the model actually chose to load.

Persona files (content approved; implementation wiring is a separate concern — see roadmap):
- [rules/personas/explorer.md](rules/personas/explorer.md)
- [rules/personas/architect.md](rules/personas/architect.md)
- [rules/personas/product_owner.md](rules/personas/product_owner.md)
- [rules/personas/sequencer.md](rules/personas/sequencer.md)
- [rules/personas/developer.md](rules/personas/developer.md)
- [rules/personas/logic_reviewer.md](rules/personas/logic_reviewer.md)
- [rules/personas/standards_reviewer.md](rules/personas/standards_reviewer.md)

Standards:
- [rules/standards/clean_architecture.md](rules/standards/clean_architecture.md)
- [rules/standards/hexagonal_ddd_manifesto.md](rules/standards/hexagonal_ddd_manifesto.md)

## Sandboxing & tools

Two-tier Docker model:

- **Root sandbox** ([docker-compose.yml](docker-compose.yml)): one long-lived container named `ai_sandbox` based on `debian:stable-slim`, `network_mode: none`, with `./projects` mounted at `/workspace`. This is what `execute_command` targets. It exists only to run **plain shell commands** (file operations, navigation, piping) without giving the model host access.
- **Per-project sandbox**: each project folder carries its own `docker-compose.yml` for language-specific runtimes (Python, Node, Rust, etc.). Build and test commands that need a real toolchain run against the project's own container, not the root sandbox. How the model dispatches to it is an open question (see below).

Other ground rules:

- The local Ollama model runs on GPU/VRAM on the host (Docker is CPU-focused and cannot host it).
- Tools run **autonomously** (no confirmation prompts). Every tool call must be **logged** for later audit.
- **Git operations are manual** for now. Do not add commit/branch tools yet.
- The tool set is grown **on demand** — add tools when the model demonstrably needs one, not preemptively. Current tools live in [tools/](tools/): `list_files`, `execute_command`.

## Code conventions (for the orchestrator itself)

- Python, latest LTS, `pip` with [requirements.txt](requirements.txt).
- `snake_case`, type hints, Python best practices.
- Prioritize **user experience** in the terminal interface (Rich).
- **Test-first**: write failing tests before functional logic whenever feasible.
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
├── agents/                 # persona classes (architect, developer, base, factory)
├── context/                # prompt/context builders, rules loader
├── interface/              # terminal loop, command processor
├── tools/                  # model-callable tools
├── rules/
│   ├── personas/           # personas + their workflows (markdown)
│   └── standards/          # on-demand reference rules (markdown)
├── projects/               # each child is its own git repo, developed by the model
├── docker-compose.yml
└── run.ps1                 # install / start / stop
```

The [README.md](README.md) still documents the older layout (`orchestrator/`). Treat the tree above as current; the README is being rewritten as the restructure stabilizes.

## Commands (as of today)

Host:
- `.\run.ps1 install` — install everything
- `.\run.ps1 start <project-name>` — start session for a project
- `.\run.ps1 stop` — shut down Docker

In-app (Rich terminal):
- `/swap <persona>` — switch active persona
- `/exit` — quit
- (README also lists `/switch`, `/clear`, `/models list`, `/models pull` — [main.py](main.py) currently only implements `/swap` and `/exit`. Confirm with the user before relying on the others.)

## Environment

- [.env.example](.env.example) currently only sets `OLLAMA_NUM_CTX`. Model name and active persona will eventually move to the UI, not `.env`.

## Open questions / not yet decided

Track these here as they come up so future-you knows what's still fuzzy:

- Whether a standalone Tester persona is needed, or if test-first lives inside Developer and regression checks live inside Logic Reviewer.
- Memory summarization trigger thresholds and who decides (orchestrator heuristic vs. model self-report).
- Where `PRODUCT_SPEC.md`, `AGENT_NOTES.md`, and any per-project memory file live inside each project repo (filename, folder).
- Which LLM (and which context size) powers the `search_rules` throwaway context — same local model, or a smaller/faster one?
- Whether the orchestrator should auto-initialize `AGENT_NOTES.md` on session start, or leave creation to the Explorer persona as currently specified.
- How the model invokes the per-project sandbox when it needs a real runtime (e.g., `python`, `npm test`). The root `ai_sandbox` only has bash — it has no Python, Node, Rust, etc. Possible paths: (1) give the sandbox a Docker socket so it can `docker compose run` into the project's container; (2) have `execute_command` detect "needs project runtime" and call the project's compose from the host; (3) a dedicated tool like `run_in_project(command)`.
- Scoping `execute_command` to the active project's workdir inside the sandbox (today it runs from `/workspace`, so a persona on project A could cd into project B).
