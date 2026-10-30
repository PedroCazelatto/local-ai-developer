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

## 11. Requirements are incomplete, and the Node line is the last stale copy of the version.

- **Git is missing.** The git tools shell out to a host `git`; without it the execution loop cannot
  commit anything.
- **"Node 24 LTS"** should point at [.nvmrc](.nvmrc) rather than restate a major version.
  `package.json`'s `engines` is **deleted**, [docker-compose.yml](docker-compose.yml) **interpolates**
  the pin, and `.nvmrc` is the single source of truth `scripts/run.mjs` refuses against.

  **This entry used to say "one of four places" and "the one copy left". Both were wrong**, and the
  correction is the interesting part. Three more hardcoded `node:24-slim` tags were later found in
  `sandbox.ts`, `project-templates.ts` and `projects/hello-world/docker-compose.yml` — see
  [backlog item 21](backlog/node-version-hardcoded-in-the-images.md) — and `npm test` was added to
  `package.json` afterwards, invoking `node` **directly** rather than through `scripts/run.mjs`, so the
  pin is not enforced on that path at all. **An enforcement count is a claim about the surface that
  existed when it was counted**, and this file should not restate one as though it were permanent.

**Truth:** *Node version* in [docs/cli.md](docs/cli.md), [.nvmrc](.nvmrc), `scripts/run.mjs`.

## 12. The "Models used" list was unverified, and three entries cannot run a phase.

The list has now been checked against the daemon rather than reasoned about. `/api/tags` reports
`capabilities` per model, so this is measured, not inferred:

| model | capabilities | verdict |
|---|---|---|
| `qwen2.5-coder:14b` | `completion, tools, insert` | fine |
| `qwen2.5-coder:32b` | `completion, tools, insert` | fine |
| `qwen3-coder:30b` | `completion, tools` | fine |
| `devstral:24b` | `completion, tools` | fine |
| `gpt-oss:20b` | `completion, tools, thinking` | fine |
| `qwen3.5:27b` | `vision, completion, tools, thinking` | fine — **and it is a real tag** |
| `deepseek-coder-v2:16b` | `completion, insert` | **cannot run any phase** |
| `deepseek-r1:14b` | `completion, thinking` | **cannot run any phase** |
| `codestral:22b` | `completion, insert` | **cannot run any phase** |

Two corrections to what this file previously said:

- **`qwen3.5:27b` is real.** This file called it "not a real Ollama tag — likely meant `qwen3:32b`".
  It is installed on this box at 17.42 GB and reports four capabilities including `tools`. The earlier
  claim was wrong and is withdrawn.
- **Three of the nine models are toolless, not one.** `deepseek-r1:14b` and `codestral:22b` join
  `deepseek-coder-v2:16b`. Listing any of them beside models that work, with no marker, is the exact
  trap [backlog/boot-can-pick-a-toolless-model.md](backlog/boot-can-pick-a-toolless-model.md) exists
  to close.

## 13. `projects/` — the `hello-world` exception is not mentioned.

The two stated reasons for the folder are still right. What is missing: `projects/` is git-ignored, and
`hello-world` is the **single tracked exception** so a fresh clone has something to `run start` against
immediately.

**Truth:** [docs/repo-layout.md](docs/repo-layout.md).

## 14. Requirements state no minimum Ollama version, and there now is one.

The Requirements section names Ollama with no floor. There has to be one, because the boot-time
tool-capability gate **fails closed** (OPEN-QUESTIONS.md #13): a daemon too old to report
`capabilities` leaves every installed model failing the check, so a machine full of working models
boots model-less with no hint that the daemon is the reason.

**The floor is Ollama `0.9.1` or newer** (released 2025-06-09). Researched rather than guessed, and the
two endpoints differ:

| field | endpoint | first release | date |
|---|---|---|---|
| `capabilities` | `/api/show` | `v0.6.4` | 2025-04-02 |
| `capabilities` | `/api/tags` | **`v0.9.1`** | 2025-06-09 |

(`ollama/ollama` PR #10066 merged 2025-04-01, first contained in the `v0.6.4` tag; PR #10174 *"Server:
Enhance API/tag with Capability Information"* merged 2025-06-04, first contained in `v0.9.1`.) The boot
gate reads `/api/tags`, because that returns every model's capabilities in **one** round trip where
`/api/show` would need one call per model. So `0.9.1` is the number.

This box runs **0.33.2**, far past it.

**The floor is now ENFORCED, not merely stated**, which changes what the README should say. Boot asks
the daemon its version over `/api/version` and **refuses to start** below `0.9.1`, naming the
requirement and the version found — the same shape `scripts/run.mjs` uses for the Node major. A daemon
that reports no version refuses too, for the same reason an unreadable `.nvmrc` does: a check that
cannot run must not report a pass. The refusal exists because the capability gate fails closed, so
without it an old daemon produces an accurate symptom attached to a wrong diagnosis.

**Suggested wording for Requirements:** *"Ollama 0.9.1 or newer — earlier versions do not report model
capabilities over `/api/tags`, so the orchestrator cannot confirm a model supports tool calling and
refuses to start. It also refuses any individual model whose tool support it cannot confirm."*

**Truth:** OPEN-QUESTIONS.md #13 and #72,
[backlog/boot-can-pick-a-toolless-model.md](backlog/boot-can-pick-a-toolless-model.md).

## 15. Nothing warns that `docker compose` by hand will not work correctly.

The Node version is now derived from [.nvmrc](.nvmrc) (OPEN-QUESTIONS.md #15, #76): the launcher
exports it as `NODE_VERSION` and [docker-compose.yml](docker-compose.yml)'s `image:` interpolates it —
the same pattern `ACTIVE_PROJECT` already uses in that file.

The consequence is worth stating plainly, because it is invisible until it bites: **`docker compose up`
/ `docker compose run` typed by hand, without `scripts/run.mjs`, no longer resolves to the right
image** — and `ACTIVE_PROJECT` already fails closed to `__no_project__` under exactly the same
circumstances, so a hand-run compose also mounts no project.

The supported entry points are `npm run start` / `node scripts/run.mjs start <project>`, and the README
should say so where it shows any compose command.

**Truth:** OPEN-QUESTIONS.md #76, *Node version* in [docs/cli.md](docs/cli.md),
[docker-compose.yml](docker-compose.yml).

---

## Still accurate — worth keeping as-is

- The "What is this?" framing and the note that this repo is the last one built with a cloud AI.
- The reasoning for isolating the model in Docker, and the Docker Sandbox reference link.
- "The Ollama model itself runs on the host GPU … all commands the model invokes execute inside
  Docker. The orchestrator is the only thing on the host that talks to both."
- The rationale for `rules/phases/` vs `rules/standards/` (phases auto-loaded, standards on demand).
