# 11 — `/new-project` scaffold command

**Milestone:** M5 — Real runtimes
**Depends on:** 10 (the scaffold needs to know what `run_in_project` expects).

## Why

Today `.\run.ps1 start <project-name>` assumes the project directory exists. Creating a new one manually means knowing the `docker-compose.yml` shape, the `.orchestrator/` skeleton, and the `runner` service convention. That's friction every time the user starts something new.

## Files

- New `tools/scaffold_project.py` — registers as a `BaseCommand` (user `/new-project`), not a model tool.
- Templates under a new `templates/projects/<stack>/` directory in the orchestrator repo.

## Command shape

```
/new-project <name> <stack>
```

Where `<stack>` is one of a small starting set: `python`, `node`. Add more on demand — don't pre-build templates for stacks the user doesn't actually use yet.

## What gets created

```
projects/<name>/
  .gitignore                   # stack-appropriate ignores + .orchestrator/
  README.md                    # placeholder
  docker-compose.yml           # one service "runner" with the stack's image
  Dockerfile                   # if needed; for trivial stacks, image: alone suffices
  .orchestrator/               # skeleton, empty
    memory/
    inbox/
  PRODUCT_SPEC.md              # empty section headers per persona
```

`PRODUCT_SPEC.md` skeleton sections (from the persona prompts):

```markdown
# Product Spec

## Vision

## Domain Glossary

## Epics

## User Stories

## Architectural Map

## Execution Sequence
```

No `AGENT_NOTES.md` — that's superseded by the inbox (task 04).

## Compose template

The `runner` service convention from task 10:

```yaml
services:
  runner:
    image: python:3.13-slim   # or node:22-slim, etc.
    working_dir: /workspace
    volumes:
      - .:/workspace
    network_mode: none
```

Keep it minimal. Projects can add a `Dockerfile` and `build:` later if they need installed deps.

## Initialization

The scaffold runs `git init` once in the new project directory. Bootstrap is a one-shot, not an ongoing git operation — it doesn't conflict with CLAUDE.md's "git operations are manual" rule (no commits, no branches, no remotes are touched). All subsequent git work stays manual.

## Acceptance

- `/new-project todo-api python` produces a `projects/todo-api/` with the layout above.
- `.\run.ps1 start todo-api` immediately works.
- `run_in_project("python -c 'print(1)'")` succeeds on the new project without further configuration.
