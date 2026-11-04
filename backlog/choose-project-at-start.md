# Choose the project from a list at start

**Category:** Onboarding

Today `npm run start -- <project>` needs the project's folder name typed on the command line. With no
name it stops at `Error: project name required`, so starting a session means remembering the exact
folder name and the `--` that npm needs to pass it through.

**What to build.** When `start` runs with no project name, list the projects under `projects/` and let
the user pick one. **A name given on the command line still works exactly as it does today** and skips
the list — the user's decision.

## Where the choice has to happen

The project is fixed before the orchestrator starts. `scripts/run.mjs` exports it as `ACTIVE_PROJECT`
to `docker compose up`, which bind-mounts `projects/${ACTIVE_PROJECT}` at `/workspace`, and then
forwards it as argv to `src/index.ts`, where `src/boot/main.ts` reads `process.argv[2]`. So the list
has to be shown **in the launcher, before `docker compose up`** — not in `src/boot/`.

That is the hard part. The launcher is deliberately dependency-free: plain `.mjs`, importing nothing
from `src/`. Its header says so, and it is why `SAFE_NAME` is copied there rather than imported. A
picker in the launcher either uses only `node:` modules or breaks that rule (first open decision
below).

## What must not change

- The `.nvmrc` check stays the first thing `start` does, ahead of the list.
- A picked name still has to pass `SAFE_NAME`. That check is what keeps `..` out of the bind mount, and
  a directory created by hand under `projects/` can have any name. Either list only the names that
  pass, or check the pick exactly as a typed name is checked.

## Related

[Item 17](smooth-new-project-onboarding.md) owns switching projects without a restart, and asks whether
switching is worth having at all. A list at start is the first place outside the command line that
answers "which project?", so the two should agree on what counts as a project and where the list comes
from.

When this ships, update the places that describe `start` as needing a name: `docs/cli.md` (*Host
commands*), the first line of `docs/phases.md`, `usage()` in `scripts/run.mjs`, and the usage line in
`src/boot/main.ts`.

## Open decisions

- **The launcher's dependency rule.** Build the list with `node:readline` only, which keeps
  `run.mjs` importing nothing, or allow `@clack/prompts` there so the list looks like the in-app
  pickers? `@clack/prompts` is present only after `npm run setup`.
- **What counts as a project.** Every directory under `projects/`, or only those with a
  `docker-compose.yml` (the `runner` service the execution loop needs)?
- **No projects at all.** `hello-world` ships with the repo but can be deleted, and `/new-project`
  runs only inside a session — which needs a project. Print how to get one, or offer to create one
  here (which overlaps item 17)?
- **No terminal.** With stdin not a TTY nobody can pick. Keep today's error?
- **Order.** Alphabetical, or last-used first? Last-used needs somewhere to record it.
