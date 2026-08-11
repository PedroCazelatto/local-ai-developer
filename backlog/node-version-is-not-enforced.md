# The required Node version is declared but never enforced

**Category:** Repo hygiene

`package.json` declares `"engines": { "node": ">=24" }`, and `3cc8b7b` moved to 24 for a specific
reason: `node:sqlite` is unflagged there, and the phase-context store depends on it.

The machine this repo is developed on runs **Node v22.14.0**. Nothing notices. `engines` is advisory
unless `engine-strict` is set, and the `dev` script passes `--disable-warning=ExperimentalWarning`
rather than `--experimental-sqlite`, so on 22 the flag that would make `node:sqlite` available is not
passed either. A real `npm run start` on this machine would therefore be expected to fail when it opens
`memory.db` — **this has not been confirmed by running it**, because running the app is not something
this repo's workflow does casually, and confirming it is part of the task.

The failure would land at session boot, after Docker has come up, with an error about a module rather
than about a Node version — which is the wrong end of the problem to be told about.

## The shape of a fix

Something at the front of the process that compares `process.versions.node` against the declared range
and says so in one line. `scripts/run.mjs` is the natural place: it already runs before anything else,
it is dependency-free, and it is where the other pre-flight checks would go.

## Open decisions

- **Where the check lives** — `run.mjs` (runs first, no deps, but duplicates the range from
  `package.json`), `npm run setup` (runs once, so a later Node downgrade goes unnoticed), or
  `engine-strict=true` in `.npmrc` (free, but only fires on install and gives npm's message rather
  than one that mentions `node:sqlite`).
- **Whether it refuses or warns.** The product's stated mode is "start a batch and walk away", which
  argues for refusing at the front rather than failing at the back.
- **Whether the range is read from `package.json` or duplicated.** `run.mjs` deliberately imports
  nothing, and it already carries one commented copy of a pattern for the same reason.
- **Whether 24 is still the floor.** It was chosen for unflagged `node:sqlite`; if that is the only
  reason, the check should say so, because it is the fact that makes the version non-negotiable.
