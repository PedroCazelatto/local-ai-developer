# Local AI Developer

## What is this?

What a better way to learn how to code with an AI than to orchestrate AI Development?

This is my attempt to make AI iterate on code development, learning all the basics of prompt engineering, interaction isolation and many other things.

All of this while not spending a penny on inference. Just using my RTX 3060 and electrical bill to run everything.

> **Note on tooling:** I'm using Claude Code as an advisor to build this orchestrator itself — the one repo that is *not* developed by a local model. The whole point of the project is the **projects inside `projects/`**: starting from the next project created here, the local Ollama model does the coding. This bootstrapping repo is the last one that leans on a cloud-hosted AI.

## Requirements

- Ollama App
- Docker
- Python 3 (latest LTS)

## Commands

### Host

- `.\run.ps1 install` — install everything
- `.\run.ps1 start <project-name>` — start the orchestrator focused on _project-name_
- `.\run.ps1 stop` — shut down Docker

## What is the application?

The main application is a Python Rich Terminal with an input and some commands.

Behind the terminal, a local model is used to create everything. As the Ollama API is stateless, each request contains it's own context window, and by playing with an array of contexts, we can create virtually infinite agents to work on the project.

To develop a good application with AI, as we give more specification to the model, the better it performs. To reduce the workload, we can make another model ask us what we want to develop and let it write the specifications, raising questions and detailing everything that should and shouldn't be developed.

So that is the principle behind the phases at this application:

1. Discovery
2. Design
3. Breakdown
4. Worker
5. Reviewer

## In-app commands (Rich terminal)

- `/exit` — stop the application

Model management and context-reset commands are planned but not yet implemented.

## Phases

The orchestrator exposes several phases:

- **Discovery** — extracts requirements from the user, defines versions and list all the features in Epics;
- **Design** — make tech decisions, define boundaries and the architecture the Stories;
- **Breakdown** — turns requirements into Tasks, prioritizing them;
- **Worker** — writes failing tests, then code;
- **Reviewer** — verifies behavior and correctness;
- **Retro** — If some confusion gets caught by the Worker or Reviewer, the Retro finds the root cause and adjust the necessary file to avoid repeating the same error in the future;

The flow is not linear — after the reviewers run, the user can loop back to any planning phase to revise the plan before the next Worker phase.

Phase definitions live as Markdown in [rules/phases/](rules/phases/) (all currently marked DRAFT). Reusable standards live in [rules/standards/](rules/standards/) and are loaded on demand.

## Models used

I've selected some models to run locally, but you can choose the one that fits you the best:

1. qwen2.5-coder:14b
2. qwen3.5:27b
3. qwen3-coder:30b

The model name is currently hardcoded in [main.py](main.py). Moving that choice to the terminal UI is planned.

## AI Inference

To run the model, I'm using Ollama — it manages VRAM and RAM seamlessly.

## AI Interaction Isolation

Any model allowed to run code must be isolated from the host. Docker is experimenting with `Docker Sandbox`, a hardware-isolated microVM, but it's still experimental — so this project uses standard Docker containers for now.

Reference: https://www.docker.com/blog/docker-sandboxes-run-agents-in-yolo-mode-safely

The Ollama model itself runs on the host GPU (Docker is CPU-focused and cannot host it). All **commands the model invokes** and all **project code it generates** execute inside Docker. The orchestrator is the only thing on the host that talks to both.

## AI Orchestrator

A Python CLI that ties the model, the tools, and the rules together. It manages:

- **Session context** — a living array of messages, with each phase inside.
- **Phase switching** — the active phase's Markdown file is injected into the model prompt.
- **Rules** — phases are auto-loaded; standards are fetched on demand (design in progress).
- **Tool dispatch** — every tool call runs inside the project's Docker container.

### Human Interface

The terminal interface uses [Rich](https://rich.readthedocs.io/).

## Folder structure

```
local-ai-developer/
├── main.py                 # CLI entry; owns the REPL loop
├── core/
│   ├── session/            # orchestrator, memory, state, manager
│   ├── container/          # Docker client
│   ├── llm/                # Ollama provider
│   └── ui/                 # Rich renderer + theme
├── agents/                 # phases classes (architect, developer, base, factory)
├── context/                # prompt/context builders, rules loader
├── interface/              # terminal loop, command processor
├── tools/                  # model-callable tools (list_files, execute_command)
├── rules/
│   ├── phases/             # phase definitions + their workflows
│   └── standards/          # on-demand reference rules
├── projects/               # each child is its own git repo, developed by the model
├── docker-compose.yml
└── run.ps1                 # install / start / stop
```

There are two reasons for the `projects/` folder to exist:

1. Isolate project code from the orchestrator's extra files — each project can be shipped independently.
2. Single source of truth for development rules across all projects, without cloning this repo or copying files every time a rule changes.
