# CLAUDE.md

Index for Claude Code working in this repo. This file is **not** consumed by the local Ollama model —
that model gets its instructions from [rules/](rules/).

A **TypeScript/Node CLI** that orchestrates a locally-run Ollama model to autonomously develop code
projects, on one RTX 3060, with no cloud spend.

## Prime directive: do not assume, ask

This project's requirements live mostly in the user's head. **If you have any doubt, ask.** If a
decision is not already specified — here, in the docs below, in [constitution.md](constitution.md),
or in the code — you must ask the user before acting. Never fill a gap with an assumption. A missing
decision is a question for the user, not a default for you to pick. This covers small decisions too:
tool signatures, file layout, naming, what a phase means.

Corollary: when you learn a new product requirement in conversation, propose adding it to the doc
that owns the topic.

## Working rules

> [!IMPORTANT]
> **Never run the full app to test a change.** `npm run start` (and `node scripts/run.mjs start`)
> boots a live session against Ollama and burns a large number of tokens. The only npm scripts you
> may run are **`npm run setup`** and **`npm run typecheck`**.

- **Verify by driving code directly.** Write throwaway `.ts`/`.js` files that import and call the
  specific functions — another reason for the one-function-per-file rule: units stay callable in
  isolation. For rendering changes, replay the real renderer + readline through a terminal-grid
  emulator harness instead of launching the app.
- **Read [constitution.md](constitution.md) before writing or changing any code, every session.**
- **Do not edit [README.md](README.md)** unless asked; validate it when requested.
- **Keep these docs current.** If a change makes a doc wrong, fixing the doc is part of that change.
  Edits to this file, [constitution.md](constitution.md), and anything under [docs/](docs/) are
  **never auto-committed** — hand the diff to the user (see *Instruction integrity* in the
  constitution).

## Documentation index

| Doc | Read it when you need |
|---|---|
| [constitution.md](constitution.md) | **The quality bar for code.** TypeScript conventions, `never any`, one function per file, exact token counts, tool logging, git workflow, terminal-UX invariants, instruction integrity. |
| [docs/product.md](docs/product.md) | What the project is and is not — goals, non-goals, no parallelism, OS-agnostic reach, how terminal output renders. |
| [docs/mental-model.md](docs/mental-model.md) | One model, many context windows — stateless chat API, what a "subagent" really is, what a phase is, and the memory model (phase **contexts** as titled, addressable records in SQLite, a fresh one per boot, `/clear` · `/resume`, the summarization failsafe, `num_ctx` isolation). |
| [docs/phases.md](docs/phases.md) | How a session works — planning phases (Discovery/Design/Breakdown) and `ask_user`, the execution loop (Worker/Reviewer, 5-round cap, `raise_blocker`), Retro, the cross-phase inbox, git/commit policy. |
| [docs/rules-loading.md](docs/rules-loading.md) | The [rules/](rules/) folders and how the model retrieves standards — `search_rules` / `load_rule` and the throwaway search context. |
| [docs/sandboxing.md](docs/sandboxing.md) | The two-tier Docker model — `ai_sandbox`, per-project `runner`, `execute_command` vs. `run_in_project`, tool ground rules. |
| [docs/repo-layout.md](docs/repo-layout.md) | Where code lives, plus the [backlog/](backlog/) convention (one file per task; delete it in the commit that ships the work). |
| [docs/cli.md](docs/cli.md) | Host and in-app commands, model selection at boot, environment variables. |
| [docs/open-questions.md](docs/open-questions.md) | What is still undecided — check before assuming a default. |
