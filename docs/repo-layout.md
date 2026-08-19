# Repo layout & backlog

## Layout

```
local-ai-developer/
├── src/
│   ├── index.ts            # CLI entry; boots the session
│   ├── core/
│   │   ├── session/        # orchestrator, memory, batch, backlog, inbox, blocker, retro, reviewer, worker, subagents
│   │   ├── container/      # Docker sandbox + per-project runner (dockerode)
│   │   ├── llm/            # Ollama client, one-shot throwaway calls, stream filter, json repair
│   │   └── ui/             # renderer, status bar, theme, prompts, spinner
│   ├── phases/             # phase abstraction + factory + the per-phase tool allowlists
│   ├── context/            # system/phase prompt + generated tool list + standards catalog loaders
│   ├── interface/          # REPL, command registry, /commands
│   └── tools/              # actions — each file is a model-callable tool
├── rules/
│   ├── phases/             # phase instruction sets (markdown), injected on phase load
│   ├── standards/          # on-demand reference rules (markdown), searchable via search_rules
│   └── prompts/            # orchestrator-owned one-shot prompts; never searchable by the model
├── docs/                   # the docs indexed by CLAUDE.md
├── backlog/                # one markdown file per pending task; delete + commit on completion
├── projects/               # each child is its own git repo, developed by the model (one exception below)
├── scripts/
│   └── run.mjs             # cross-platform launcher: install / start <project> / stop
└── docker-compose.yml
```

### The one exception under `projects/`

`projects/` is git-ignored, so a project the model develops never lands in this repository — each is
its own git repo, created by `/new-project`, and it stays outside this one. **`hello-world` is the
single exception**: it is the example project, tracked here as ordinary files so a fresh clone has
something to `run start` straight away. It is exactly what `/new-project hello-world node` produces —
`README.md`, `PRODUCT_SPEC.md`, `docker-compose.yml`, `backlog/README.md`, and its own `.gitignore`,
which keeps `.orchestrator/` out of this repository the same way it would out of its own. It has
**no `.git` of its own**: nesting one would make this repository see a gitlink instead of the example.
The root `.gitignore` implements the exception with `projects/*` (not `projects/`, which git could
never descend into) plus `!projects/hello-world/`.

## Backlog

Pending work lives as **one Markdown file per task** in [backlog/](../backlog/) — there is no single
list file. Each file is named with a descriptive kebab-case slug (e.g. `persistent-fenced-input.md`)
and holds just the task: an `# H1` title, a `**Category:**` line, and the prose description — no
frontmatter, no source tags.

- **Adding a task:** create `backlog/<slug>.md` with the title, category, and description.
- **Finishing a task:** when the work ships, **delete that task's file and commit the deletion in the
  same commit as all the code the task required** — the removed backlog file is the record that the
  feature landed.
