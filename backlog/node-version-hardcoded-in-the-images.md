# The Node version is still hardcoded in the sandbox and the runner

**Category:** Repo hygiene

[`39b16e9`](../scripts/run.mjs) made `.nvmrc` the single source of truth for the Node version and
enforced it in three places — `run.mjs` refuses `start` and `install` below the pinned major,
`docker-compose.yml` interpolates the pin through a `NODE_VERSION` the launcher exports, and
`package.json`'s `engines` was deleted. Its closing arithmetic was *"four declarations, none enforced,
become one declaration enforced in three places."*

**The arithmetic was wrong.** Three more declarations survive, none of them enumerated by that task,
all of them still spelling the version by hand:

| Where | What it does |
|---|---|
| `src/core/container/sandbox.ts:36` | `const DEFAULT_IMAGE = 'node:24-slim'` — the fallback container-create path, used when the compose-managed sandbox is absent |
| `src/interface/commands/project-templates.ts:43` | `compose: runnerCompose('node:24-slim')` — the image every **new** project's runner is scaffolded with |
| `projects/hello-world/docker-compose.yml:3` | `image: node:24-slim` — the same tag, already baked into the one committed example project |

Four comments also name the tag as descriptive prose rather than as a declaration:
`sandbox.ts:53`, `project-templates.ts:24`, `project-git.ts:3` and `list-workspace-entries.ts:6`.
The last two are reasoning *about* the image (it is Debian-based, so it ships GNU findutils; it ships
no git), which is a fact about the base image rather than about the version — those may well be
better left alone. Decide deliberately rather than sweeping them.

## Why this is not simply "finish the job"

The two-tier Docker model in [docs/sandboxing.md](../docs/sandboxing.md) makes this less obvious than
it looks. `ai_sandbox` and a project's `runner` are **different containers with different jobs**, and
only the first is the orchestrator's own execution environment.

- **`sandbox.ts`'s `DEFAULT_IMAGE` is clearly the same declaration** `39b16e9` was consolidating. It is
  the root sandbox, the orchestrator's own tool-execution container, and the whole argument for
  pinning it — *the Node a project's code is built and tested against is the Node the orchestrator
  itself runs on* — applies to it verbatim. This one is a straightforward miss.
- **The per-project runner is a genuine question, and it is the user's.** A project the model is
  building is not the orchestrator. Forcing every scaffolded project onto the orchestrator's Node pin
  says the harness's runtime choice is also the built project's runtime choice, which may be exactly
  right for a single-user local tool — or may be precisely the coupling to avoid, since a project
  might legitimately target a Node the orchestrator does not run.

**Do not assume the second follows from the first.** Ask.

## Open decisions — all of them the user's

- **Does the per-project runner follow `.nvmrc`, or keep its own version?** If it follows, the
  scaffold in `project-templates.ts` interpolates rather than spells; if it keeps its own, that should
  be *stated* in `docs/sandboxing.md` as a deliberate boundary rather than left looking like the same
  oversight.
- **What happens to `projects/hello-world/docker-compose.yml`?** It is a committed example, so it is
  documentation as much as configuration. If the runner follows the pin, this file has to be
  regenerated — and regenerating it changes a file inside `projects/`, which `.gitignore` treats
  specially (`projects/*` plus a negation for exactly this one directory).
- **How does `sandbox.ts` learn the version?** It cannot read `.nvmrc` the way `run.mjs` does without
  adding a file read to a module that currently has none — and `run.mjs` already exports
  `NODE_VERSION` into the environment of every `docker compose` call it makes, which the fallback
  create path is not. Reading `process.env.NODE_VERSION` with a fail-loud absent branch is the obvious
  shape, but "obvious" is not "decided".
- **Do the four descriptive comments change?** See above; at least two of them are about the base
  image, not the version.

## Why it sits where it does

It is small, it is pure hygiene, and nothing depends on it. It is filed rather than folded into the
one-function-per-file sweep on purpose: `sandbox.ts` is being rewritten by that sweep, and burying a
behaviour change inside a no-behaviour-change refactor commit is how a defect stops being reviewable.
The sweep carries `DEFAULT_IMAGE` across unchanged and reports where it landed.
