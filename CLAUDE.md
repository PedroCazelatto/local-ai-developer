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
2. Pedro drives a planning-oriented persona (Explorer → Architect → Product Owner → Prioritizer) to produce a written plan. Plans are project-scoped artifacts stored **inside the project repo** (not in the orchestrator repo) — the project carries its own agent files.
3. The plan is sliced into narrower tasks picked up by the **Developer**; the **Reviewer** checks the result after each phase. Test-first discipline lives inside the Developer persona (failing tests before implementation).
4. Pedro only interacts while planning and between phases. Within a phase the model runs autonomously with no per-tool confirmation.
5. At the end of each phase, the in-memory context is cleared.

### Planned personas (names provisional)

- **Explorer** — runs discovery to extract product requirements from Pedro.
- **Architect** — designs system architecture, boundaries, deployment.
- **Product Owner** — transforms requirements into tasks.
- **Prioritizer** — orders requirements/tasks by priority (name TBD).
- **Developer** — transforms tasks into code, writing failing tests first.
- **Reviewer** — reviews output (may split into logic-focused and standards-focused sub-personas).

The list is open — new personas can be added.

## Memory model

- **In-session memory**: a living array of messages. Trimmed when a token threshold is crossed OR when the model's own output is large (summarize then replace). Cleared at phase boundaries.
- **Per-project persistence**: each project keeps its own memory so the model always knows where it stopped. Persistence lives with the project (see §1 of session flow).
- **Documentation files** (rules, plans, specs) exist for one-time reference or human reading — not loaded into every prompt.

Minimize persistent context to save tokens (local inference is VRAM-bound).

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

Existing files to be aware of:
- [rules/personas/architect_po.md](rules/personas/architect_po.md) — legacy combined persona, slated to be split into Architect + Product Owner.
- [rules/personas/explorer.md](rules/personas/explorer.md) — seeded from the former `workflows/discovery_process.md`; still needs the persona frame around it.
- [rules/standards/clean_architecture.md](rules/standards/clean_architecture.md)
- [rules/standards/hexagonal_ddd_manifesto.md](rules/standards/hexagonal_ddd_manifesto.md)

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
- (README also lists `/switch`, `/clear`, `/models list`, `/models pull` — [main.py](main.py) currently only implements `/swap` and `/exit`. Confirm with Pedro before relying on the others.)

## Environment

- [.env.example](.env.example) currently only sets `OLLAMA_NUM_CTX`. Model name and active persona will eventually move to the UI, not `.env`.

## Open questions / not yet decided

Track these here as they come up so future-you knows what's still fuzzy:

- Splitting `architect_po.md` into separate Architect and Product Owner persona files (requires content rework — not done yet).
- Filling out the Explorer persona frame around the existing discovery workflow content.
- Whether Reviewer stays as one persona or splits into logic-focused and standards-focused variants.
- Whether a standalone Tester persona is needed, or if test-first lives inside Developer and regression checks live inside Reviewer.
- Naming for the Prioritizer persona.
- Memory summarization trigger thresholds and who decides (orchestrator heuristic vs. model self-report).
- Where project-scoped plan/memory files live inside each project repo (filename, folder).
- Which LLM (and which context size) powers the `search_rules` throwaway context — same local model, or a smaller/faster one?
