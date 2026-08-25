# The required Node version is declared but never enforced

**Category:** Repo hygiene

`package.json` declares `"engines": { "node": ">=24" }`, [`.nvmrc`](../.nvmrc) pins `24.14.0`,
[README.md](../README.md) says "Node 24 LTS" and [docker-compose.yml](../docker-compose.yml) runs
`node:24-slim`. **Four declarations, no enforcement** — `engines` is advisory unless `engine-strict`
is set, and nothing compares `process.versions.node` against anything.

The machine this repo is developed on runs **Node v22.14.0**, and nothing notices.

## The original premise was wrong, and it is corrected here

The task was filed on the belief that `3cc8b7b` moved to 24 because `node:sqlite` is unflagged there,
and that a real `npm run start` on v22.14.0 would therefore fail when the phase-context store opens
`memory.db`. **That failure does not occur.** `node:sqlite` works on the v22.14.0 this box runs, and
nothing else in `src/` needs Node 24. The `dev` script's `--disable-warning=ExperimentalWarning` was
read as evidence of a missing `--experimental-sqlite`; it is not.

So the floor was kept at `>=24` on other grounds (OPEN-QUESTIONS "already answered" #3), and the check
had to be given a justification that is actually true: a repo that declares one version in four places
and enforces none of them tells you nothing about what it was tested on.

[backlog/README.md](README.md)'s line for this task still asserts the old premise. **Correcting it is
part of the shipping commit** — the same commit that deletes this file.

## The shape of a fix

`.nvmrc` becomes the single source of truth, and the other three declarations follow it. Then a
front-of-process check in `scripts/run.mjs`, which already runs before anything else and imports
nothing.

## Decisions (answered — OPEN-QUESTIONS.md #15–#21)

- **`.nvmrc` is the source of truth, and Docker follows it** (#15). The root sandbox image tag is
  derived from `.nvmrc` rather than being a floating `node:24-slim`, so the Node a project is built and
  tested against is the Node the orchestrator runs on.
- **Making the shell honour `.nvmrc` is the real fix** (#19a) — machine setup, no code. The in-process
  check is the backstop, not the remedy.
- **`start` is gated; `install` warns; `stop` is untouched** (#16 + #17c). `start` refuses outright,
  because that is where a walk-away batch would otherwise fail hours later; `install` on the wrong Node
  still produces a usable `node_modules`, so it warns and continues.
- **The refusal line is drafted for review, not written blind** (#18b) — see
  [OPEN-QUESTIONS.md](../OPEN-QUESTIONS.md) #74. It no longer names `node:sqlite`, since that is
  no longer the reason.
- **The stale premises are corrected in the shipping commit, and this file is then deleted** (#20a).
- **`README.md` is not touched by the agent** (#21). Its Node line — and every other thing in it that
  has drifted — is listed in [README-INCONSISTENCIES.md](../README-INCONSISTENCIES.md) for the user to
  fix by hand.

## Still open

- **#19a vs #16/#17 — does a check ship at all?** #19 answers **a**, "machine setup, no code", where
  **c** was "both"; #16 and #17 both describe a check. This file and the docs assume **both**: the
  shell fix is the remedy, the `run.mjs` check is the backstop for a shell nobody switched. Confirm
  before building it ([OPEN-QUESTIONS.md](../OPEN-QUESTIONS.md) #73).
- **Where `run.mjs` gets the range from.** Reading `.nvmrc` is a dependency-free `readFileSync` and
  keeps the single source of truth honest; duplicating the range inline follows the `SAFE_NAME`
  precedent, which is already a deliberate copy carrying a "change one, change the other" comment.
  Not asked in the first pass; now **#75**.
- **How `docker-compose.yml` reads `.nvmrc`.** Compose cannot read a file into an image tag on its own:
  either `run.mjs` exports the version as an env var that `image:` interpolates
  (`node:${NODE_VERSION}-slim`), or the tag is written into the file. The first keeps one source of
  truth; the second keeps `docker compose up` working without the launcher. Now **#76**.
