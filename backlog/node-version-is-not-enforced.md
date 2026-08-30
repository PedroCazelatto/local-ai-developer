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

## Decisions (answered — OPEN-QUESTIONS.md #15–#21, #73–#76)

- **`.nvmrc` is the single source of truth** (#15a), and everything else derives from it. It pins
  `24.14.0`.
- **`run.mjs` reads `.nvmrc` directly** (#75a) — a dependency-free `readFileSync`, no second copy of
  the version to drift. The `SAFE_NAME` precedent (a deliberate inline duplicate carrying a "change
  one, change the other" comment) is **not** followed here: duplication is the defect this task exists
  to remove. `run.mjs` has to cope with `.nvmrc` being absent or malformed — decide *how* in the
  shipping commit, but it must not be a silent pass.
- **Both `start` and `install` refuse** (#73 — *changed*; this replaces "`start` refuses, `install`
  warns and continues"). `stop` is never gated: tearing containers down must work on any Node, and
  gating it would strand a user who cannot bring the stack down without first switching runtimes.
- **The version test keeps the range, and reads the number from `.nvmrc`** (#74). Both parts matter and
  they are not in tension: `.nvmrc`'s `24.14.0` is where the number comes from, and the **major** is
  what is compared — so v24.1.0 passes, v22.14.0 fails. A user on any Node 24 can run the repo; the pin
  says which one it was developed against, not which one is mandatory.
- **Making the shell honour `.nvmrc` is still the real remedy** (#19c — *changed from a to c*, "use
  both"). The in-process check is the backstop for a shell nobody switched, not a substitute for
  switching it.
- **`docker-compose.yml` interpolates the version from an env var the launcher exports** (#76a) —
  `image: node:${NODE_VERSION:-...}-slim`, following the `ACTIVE_PROJECT` pattern already in that file.
  The cost is real and accepted: **`docker compose up` run by hand, without `run.mjs`, no longer
  resolves to the right image.** That warning is recorded in
  [README-INCONSISTENCIES.md](../README-INCONSISTENCIES.md) (#76).
- **The stale premises are corrected in the shipping commit, and this file is then deleted** (#20a).
- **`README.md` is not touched by the agent** (#21). Its Node line — and every other thing in it that
  has drifted — is listed in [README-INCONSISTENCIES.md](../README-INCONSISTENCIES.md) for the user to
  fix by hand.

## The refusal wording (#74a, taken as drafted, with the two-numbers question answered)

Both verbs refuse now, so `install` gets the refusal shape rather than the warning shape:

```
✗ Node 24 is required — found v22.14.0.

  This repo pins 24.14.0 in .nvmrc. Run `nvm use` in this directory (or the equivalent
  for your version manager) and try again.
```

It names both numbers on purpose, and #74 settled which does what: **`24` is the requirement**
(the comparison), **`24.14.0` is the pin** (where the requirement is read from, and what the repo was
developed against). Dropping the range would over-state the requirement; dropping the pin would leave
the user with nothing to `nvm use`. It no longer names `node:sqlite`, since that is no longer the
reason.

## `engines` is now redundant, and that is a decision left over

`package.json`'s `"engines": { "node": ">=24" }` is a **fourth** declaration of a number that #15 just
made `.nvmrc`'s to own, and #75a routes the check around it. It is advisory unless `engine-strict` is
set, so it enforces nothing either way — but leaving a second copy in place is the exact defect this
task removes everywhere else. Whether it is deleted, left as npm-facing metadata, or generated from
`.nvmrc` is not decided: see [OPEN-QUESTIONS.md](../OPEN-QUESTIONS.md) **#80**.
