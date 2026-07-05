> **Status:** ✅ Completed (2026-07-04)

# 07 — `/new-project` scaffold command

**Version:** V1
**Depends on:** V1/05 (the scaffold must declare exactly what `run_in_project` expects: a networked `runner` service), Foundation/05 (the REPL command layer this registers into).
**Blocks:** every project-building flow — Discovery onward needs a project to write into.

## Why

`run start <name>` assumes the project exists. Creating one by hand means knowing the `docker-compose.yml` shape, the `runner` convention, and the `.orchestrator/` skeleton. Port old `tasks/11-project-scaffold-command.md` — but **networked + hardened** (no `network_mode: none`), and using the **inbox** (`.orchestrator/inbox/`) instead of `AGENT_NOTES.md`.

## Behavior

### Command shape

```
/new-project <name> <stack>
```

A **user command** (a `BaseCommand`-equivalent in the TS REPL, invoked with `/`) — **not** a model tool. The model never scaffolds projects; the user does. `<stack>` is one of a small starting set: `python`, `node`. Add more **on demand** — don't pre-build templates for stacks not yet used.

- Validate `<name>` (safe directory name, not already present under `projects/`) and `<stack>` (in the known set). On bad input, print a clear message and do nothing.

### What gets created

```
projects/<name>/
  .gitignore                 # stack-appropriate ignores + .orchestrator/
  README.md                  # placeholder
  docker-compose.yml         # one networked, hardened "runner" service
  .orchestrator/
    memory/                  # empty (V4 per-phase history)
    inbox/                   # empty (V3 cross-phase inbox) — supersedes AGENT_NOTES.md
  PRODUCT_SPEC.md            # skeleton section headers
```

- **No `AGENT_NOTES.md`** — superseded by the inbox.
- `.gitignore` ignores `.orchestrator/` (audit log, memory, inbox, backlog are local session state, not committed) plus stack-appropriate entries (`node_modules/`, `dist/` for node; `__pycache__/`, `.venv/`, `*.pyc` for python).

### `PRODUCT_SPEC.md` skeleton

```markdown
# Product Spec

## Vision

## Domain Glossary

## Epics

## Stories

## Architecture

## Execution Sequence
```

(Section names align with what the planning phases write — V1/08. The backlog itself lives in `.orchestrator/backlog.json`, V1/09, not in this file.)

### Compose template — networked + hardened `runner`

The `runner` service convention from V1/05, now with **network on** and the dockerode-model hardening (rootless user, CPU/RAM caps):

`node` stack:
```yaml
services:
  runner:
    image: node:22-slim
    working_dir: /workspace
    volumes:
      - .:/workspace
    user: "1000:1000"          # rootless; matches the slim image's non-root uid or a created one
    mem_limit: 2g
    cpus: 2.0
    # network: default (enabled) — installs need it. Do NOT set network_mode: none.
```

`python` stack: same shape with `image: python:3.13-slim`.

- **Networked:** no `network_mode: none`. Reverses the old air-gap (the pivot) so `npm i` / `pip install` work via `run_in_project`.
- **Hardened:** rootless `user:`, `mem_limit`, `cpus`. Keep caps modest (a 3060 box; CPU-bound container work).
- Keep it minimal; projects can add a `Dockerfile` + `build:` later for pinned deps.

### Initialization

- Run `git init` **once** in the new project dir (one-shot bootstrap; no commits, branches, or remotes — those stay manual per CLAUDE.md).
- Each project is its **own git repo** (CLAUDE.md, "Repo layout"). All planning artifacts live inside it.

## Files

- `src/interface/commands/new-project.ts` — the `/new-project` command handler: validates args, writes the tree, runs `git init`.
- `src/templates/projects/<stack>/` — template files per stack (`.gitignore`, `docker-compose.yml`, `README.md`, `PRODUCT_SPEC.md`). `node` and `python` to start.
- `src/interface/commands/registry.ts` (or wherever Foundation/05 registers commands) — register `/new-project`.

## Notes / pitfalls

- **User command, not a model tool** — it must not appear in `toolDefinitions()` (V1/02). The model gets file/shell/run tools; scaffolding is the human's.
- **Networked + hardened, not air-gapped** — the single biggest port change from old task 11. Do not copy `network_mode: none`.
- **`runner` is the exact service name** `run_in_project` (V1/05) targets — don't rename it.
- **`.orchestrator/` is gitignored** — session state (audit, memory, inbox, backlog) is local, not committed.
- **`inbox/` not `AGENT_NOTES.md`** — the inbox dir is created empty here; the inbox tooling is V3, but the skeleton folder ships now.
- The `user:` uid must be one the slim image can map; if `node:22-slim`/`python:3.13-slim` lack a usable non-root uid, pin to one the volume mount can write through (Windows bind-mount permissions are forgiving, but document the choice).

## Acceptance

- `/new-project todo-api node` → `projects/todo-api/` exists with `.gitignore`, `README.md`, a networked+hardened `docker-compose.yml` (no `network_mode: none`, has `user:`/`mem_limit`/`cpus`), `.orchestrator/{memory,inbox}/`, and the `PRODUCT_SPEC.md` skeleton; `git status` inside it shows an initialized repo.
- `run start todo-api` immediately works (boots the REPL locked to the new project).
- `run_in_project("node -e 'console.log(1)'")` (or `python -c 'print(1)'` for a python project) succeeds with no further configuration, and `npm i some-pkg` actually installs (proves network).
- `/new-project todo-api node` a second time → refuses (already exists), leaves the existing project untouched.
- `/new-project x ruby` → rejected with "unknown stack" (only `python`/`node` for now).
