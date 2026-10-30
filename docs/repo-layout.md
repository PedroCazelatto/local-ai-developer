# Repo layout & backlog

## Layout

```
local-ai-developer/
├── src/
│   ├── index.ts            # CLI entry; loads .env, then runs the boot sequence
│   ├── boot/               # the sequence index.ts runs: argv, config, model, sandbox, orchestrator, REPL
│   ├── core/               # orchestrator internals, grouped by concern
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

### The one exception in `backlog/`

**[split-config-into-one-function-per-file.md](../backlog/split-config-into-one-function-per-file.md)
survives its own completion**, by the user's decision, and it is the only file that does.

The reason is that it stopped being a task file. It grew to carry the *verification methodology* the
sweep developed — **seven distinct shapes of a test that passes while proving nothing**, each found by
making an instrument fail on purpose rather than by a green result looking wrong, plus the rule that
generalises them: *prove the instrument can distinguish, and prove that it ran.* None of that is about
one function per file, and deleting the file to honour the convention would have destroyed the most
reusable thing the work produced.

**Do not read it as pending work.** Item 1 is struck in [backlog/README.md](../backlog/README.md), and
the file's own header says so. Treat it as the sweep's record and as the reference for how to verify a
refactor in this repo.

**This is not a precedent for keeping a task file "for reference".** The test it passed is narrow: the
knowledge was general rather than task-specific, and there was nowhere else that owned the topic. A task
file that merely describes what was built still goes when the work ships — the commit is that record.
