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
│   ├── phases/             # phase abstraction + factory
│   ├── context/            # system/phase prompt + standards catalog loaders
│   ├── interface/          # REPL, command registry, /commands
│   └── tools/              # actions — each file is a model-callable tool
├── rules/
│   ├── phases/             # phase instruction sets (markdown), injected on phase load
│   └── standards/          # on-demand reference rules (markdown)
├── docs/                   # the docs indexed by CLAUDE.md
├── backlog/                # one markdown file per pending task; delete + commit on completion
├── projects/               # each child is its own git repo, developed by the model
├── scripts/
│   └── run.mjs             # cross-platform launcher: install / start <project> / stop
└── docker-compose.yml
```

## Backlog

Pending work lives as **one Markdown file per task** in [backlog/](../backlog/) — there is no single
list file. Each file is named with a descriptive kebab-case slug (e.g. `persistent-fenced-input.md`)
and holds just the task: an `# H1` title, a `**Category:**` line, and the prose description — no
frontmatter, no source tags.

- **Adding a task:** create `backlog/<slug>.md` with the title, category, and description.
- **Finishing a task:** when the work ships, **delete that task's file and commit the deletion in the
  same commit as all the code the task required** — the removed backlog file is the record that the
  feature landed.
