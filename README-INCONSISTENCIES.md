# README.md — what has drifted

Per OPEN-QUESTIONS.md **#21**: the agent does not edit [README.md](README.md). This is the list to fix
by hand. Every claim below was checked against the code or the docs in [docs/](docs/), and each item
names where the truth lives.

Ordered by how wrong it is, not by where it appears in the file.

---

## 1. It describes a Python application. It is TypeScript/Node.

> "## AI Orchestrator — A Python CLI that ties the model, the tools, and the rules together."

It is a **TypeScript/Node CLI** — `package.json` `"type": "module"`, `src/index.ts`, `tsx`,
`typescript`. There is no Python anywhere in the orchestrator; `python` appears only as one of the two
project *stacks* `/new-project` can scaffold.

**Truth:** [CLAUDE.md](CLAUDE.md) opening line, [docs/repo-layout.md](docs/repo-layout.md).

## 2. The whole folder-structure block is from a repo that no longer exists.

The block lists `main.py`, `run.ps1`, `agents/`, `context/`, and no `src/` at all. The real tree has
`src/{core,phases,context,interface,tools}`, `scripts/run.mjs`, `rules/{phases,standards,prompts}`,
`docs/`, `backlog/`, `projects/`.

**Truth:** [docs/repo-layout.md](docs/repo-layout.md) carries the current tree — the README block can
be replaced with it wholesale, or with a pointer to it.

## 3. "The terminal interface uses Rich."

Rich is a Python library and is not used. The interface is a hand-written renderer over `chalk`,
`ora`, and `@clack/prompts`, in `src/core/ui/` — plus a pinned status bar, an activity line, and a
fenced input box that survives a running turn.

**Truth:** [docs/cli.md](docs/cli.md), `src/core/ui/`.

## 4. "The model name is currently hardcoded in config.ts."

Two things wrong: the link `[config.ts](config.ts)` points at a file that does not exist at the repo
root, and **there is deliberately no hardcoded model at all**. A name compiled into the orchestrator
says nothing about what has actually been pulled, so boot asks the Ollama daemon and picks from the
installed set; `/models use` persists an explicit choice to `state.json`.

**Truth:** *Model selection* in [docs/cli.md](docs/cli.md),
`src/core/session/resolve-boot-model.ts`.

## 5. Two of the four Host commands do not exist.

> `npm run sandbox:up` · `npm run sandbox:down`

Neither is in `package.json`. The real script set is:

| README says | Reality |
|---|---|
| `npm i` | `npm run setup` (`node scripts/run.mjs install`) — installs deps **and** pulls the sandbox image |
| `npm run sandbox:up` | *(gone)* — the launcher brings Docker up as part of `start` |
| `npm run dev -- <project-name>` | `npm run start -- <project-name>` (`node scripts/run.mjs start <project>`) |
| `npm run sandbox:down` | `npm run stop` |
| *(missing)* | `npm run typecheck` — `tsc --noEmit` |

`dev` does still exist in `package.json`, but it is `tsx src/index.ts` and is not the documented way
in.

**Truth:** *Host commands* in [docs/cli.md](docs/cli.md), `package.json`.

## 6. "Model management and context-reset commands are planned but not yet implemented."

They shipped. The in-app command set is now `/swap`, `/new-project`, `/run`, `/answer`, `/questions`,
`/models`, `/clear`, `/resume`, `/subagents`, `/tasks`, `/blockers`, `/inbox`, `/batch`, `/audit`,
`/stop`, `/help`, `/exit`.

**Truth:** *In-app commands* in [docs/cli.md](docs/cli.md).

## 7. "Every tool call runs inside the project's Docker container."

Three ways off:

- The **git tools are host-side on purpose** (`commit_changes`, `list_changes`, `git_inspect`,
  `git_stash`, `git_branch`, `git_push`) — the root sandbox ships no git.
- There are **two containers**, not one: `ai_sandbox` (shell + file tools, mounts only the active
  project) and each project's own `runner` service (tests, builds, installs, via `run_in_project`).
- File tools move bytes over Docker's archive endpoints as a tar stream, not as shell commands.

**Truth:** [docs/sandboxing.md](docs/sandboxing.md).

## 8. "Session context — a living array of messages, with each phase inside."

The real model is **one model, many context windows**: each phase holds its own window, persisted as a
titled, addressable record in SQLite (`memory.db`), with `/clear` starting a new one and `/resume`
reopening an old one. A "sub-agent" is another window, not another process.

**Truth:** [docs/mental-model.md](docs/mental-model.md).

## 9. "Phase definitions … (all currently marked DRAFT)."

Nothing under `rules/phases/` carries a DRAFT marker any more. The line also omits `rules/prompts/` —
orchestrator-owned one-shot prompts that the model can never search.

**Truth:** [docs/rules-loading.md](docs/rules-loading.md), `rules/`.

## 10. The phase list stops at five and puts Retro outside the flow.

The numbered list is Discovery, Design, Breakdown, Worker, Reviewer — Retro is described further down
but never numbered, and the closing line ("after the reviewers run, the user can loop back to any
planning phase") describes a loop that is not the one that exists: planning is non-linear *before*
execution, execution is a Worker/Reviewer loop capped at 5 rounds, and **Retro fires when the user
answers a blocker**, not after a review.

**Truth:** [docs/phases.md](docs/phases.md).

## 11. Requirements are incomplete, and the Node line will move.

- **Git is missing.** The git tools shell out to a host `git`; without it the execution loop cannot
  commit anything.
- **"Node 24 LTS"** is one of four places the version is declared (`package.json` `engines`, `.nvmrc`,
  `docker-compose.yml`, here). `.nvmrc` is becoming the single source of truth, so this line should
  point at it rather than restate a major version.

**Truth:** *Node version* in [docs/cli.md](docs/cli.md),
[backlog/node-version-is-not-enforced.md](backlog/node-version-is-not-enforced.md).

## 12. The "Models used" list is unverified, and one entry is misleading.

- `qwen3.5:27b` does not appear to be a real Ollama tag — likely meant `qwen3:32b` or `qwen2.5:32b`.
- `deepseek-coder-v2:16b` is **confirmed toolless** on this box (`completion,insert`, no `tools`), so
  it cannot run any phase. Listing it beside models that work, with no marker, is the exact trap
  [backlog/boot-can-pick-a-toolless-model.md](backlog/boot-can-pick-a-toolless-model.md) exists to
  close.

## 13. `projects/` — the `hello-world` exception is not mentioned.

The two stated reasons for the folder are still right. What is missing: `projects/` is git-ignored, and
`hello-world` is the **single tracked exception** so a fresh clone has something to `run start` against
immediately.

**Truth:** [docs/repo-layout.md](docs/repo-layout.md).

---

## Still accurate — worth keeping as-is

- The "What is this?" framing and the note that this repo is the last one built with a cloud AI.
- The reasoning for isolating the model in Docker, and the Docker Sandbox reference link.
- "The Ollama model itself runs on the host GPU … all commands the model invokes execute inside
  Docker. The orchestrator is the only thing on the host that talks to both."
- The rationale for `rules/phases/` vs `rules/standards/` (phases auto-loaded, standards on demand).
