# CLAUDE.md

Guidance for Claude Code when working in this repo. The user is Pedro; this file is for you (Claude Code) as an advisor helping him build the orchestrator. It is **not** consumed by the local Ollama model — that model gets its instructions from [rules/](rules/).

## Prime directive: do not assume, ask

This project's requirements live mostly in Pedro's head. When a task is ambiguous, **ask clarifying questions instead of guessing**. Even small decisions (tool signatures, file layout, naming, what a phase means) should be confirmed if not already documented here or obvious from the code.

Corollary: if you learn a new product requirement during a conversation, propose adding it to this file.

## What this project is

A Python CLI that orchestrates a **locally-run** Ollama model to autonomously develop code projects. Pedro's goals:

- Learn prompt engineering, AI interaction isolation, and planning by building the orchestrator himself.
- Practice planning skills by driving the architect persona and reviewing phases.
- Run everything on his RTX 3060 — no cloud spend.
- Ship this repo as a public learning artifact, used only by Pedro.

### Non-goals

- Not a VSCode/Cursor replacement.
- Not a "vibe coding" tool.
- No backend/frontend deployment for the orchestrator itself.
- No multi-user support.
- No cross-platform support yet (Windows-first until it works flawlessly).

## How a session works

1. `.\run.ps1 start <project-name>` boots the orchestrator locked to one project. Switching projects requires restarting `main.py`.
2. Pedro interacts with the **architect** persona to produce a written plan. Plans are project-scoped artifacts stored **inside the project repo** (not in the orchestrator repo) — the project carries its own agent files.
3. Architect hands off narrower tasks to the **tester** (writes failing tests first) and then the **developer** (implements against those tests). Tester also runs after implementation to check for unexpected regressions.
4. Pedro only interacts while planning and between phases. Within a phase the model runs autonomously with no per-tool confirmation.
5. At the end of each phase, the in-memory context is cleared.

Persona list is not fixed — new personas can be added. Current files: [rules/personas/architect_po.md](rules/personas/architect_po.md).

## Memory model

- **In-session memory**: a living array of messages. Trimmed when a token threshold is crossed OR when the model's own output is large (summarize then replace). Cleared at phase boundaries.
- **Per-project persistence**: each project keeps its own memory so the model always knows where it stopped. Persistence lives with the project (see §1 of session flow).
- **Documentation files** (rules, plans, specs) exist for one-time reference or human reading — not loaded into every prompt.

Minimize persistent context to save tokens (local inference is VRAM-bound).

## Rules loading

Rules are all Markdown, under [rules/](rules/), and are **global** (projects are agnostic to the orchestrator and do not override rules).

- **Personas** ([rules/personas/](rules/personas/)): injected automatically when the active persona is loaded.
- **Standards** ([rules/standards/](rules/standards/)) and **Workflows** ([rules/workflows/](rules/workflows/)): the model receives a catalog (name + description) and pulls specific files on demand via a tool call. Exact tool shape is TBD — propose designs before implementing.

Existing files to be aware of:
- [rules/standards/clean_architecture.md](rules/standards/clean_architecture.md)
- [rules/standards/hexagonal_ddd_manifesto.md](rules/standards/hexagonal_ddd_manifesto.md)
- [rules/workflows/discovery_process.md](rules/workflows/discovery_process.md)

## Sandboxing & tools

- The local Ollama model runs on GPU/VRAM on the host (Docker is CPU-focused and cannot host it).
- **All model-invoked commands and all project code (tests, builds, sub-images) run inside Docker**, isolated from the host root. The orchestrator is the only thing on the host that talks to both.
- Tools run **autonomously** (no confirmation prompts). Every tool call must be **logged** for later audit.
- **Git operations are manual** for now. Do not add commit/branch tools yet.
- The tool set is grown **on demand** — add tools when the model demonstrably needs one, not preemptively. Current tools live in [tools/](tools/): `list_files`, `execute_command`.

## Code conventions (for the orchestrator itself)

- Python, latest LTS, `pip` with [requirements.txt](requirements.txt).
- `snake_case`, type hints, Python best practices.
- Prioritize **user experience** in the terminal interface (Rich).
- **Test-first**: write failing tests before functional logic whenever feasible.
- Do not assume — if a design choice isn't covered here or in the code, ask Pedro.

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
├── rules/                  # personas / standards / workflows (markdown)
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
- (README also lists `/switch`, `/clear`, `/models list`, `/models pull` — [main.py](main.py) currently only implements `/swap` and `/exit`. Confirm with Pedro before relying on the others.)

## Environment

- [.env.example](.env.example) currently only sets `OLLAMA_NUM_CTX`. Model name and active persona will eventually move to the UI, not `.env`.

## Open questions / not yet decided

Track these here as they come up so future-you knows what's still fuzzy:

- Exact shape of the on-demand rule-loading tool (search vs. load-by-name).
- Memory summarization trigger thresholds and who decides (orchestrator heuristic vs. model self-report).
- Where project-scoped plan/memory files live inside each project repo (filename, folder).
- Tester persona's handoff contract with developer.
