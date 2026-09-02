# `/models` lives in a second, undocumented commands directory — and its dispatcher is called `run`

**Category:** Repo hygiene

Two directories hold commands:

| directory | files | holds |
|---|---|---|
| `src/interface/commands/` | 112 | every command except one |
| `src/commands/` | 7 | `/models` and nothing else |

`docs/repo-layout.md` documents **only the first** — `src/interface/ # REPL, command registry, /commands`.
The second directory is not in the layout at all, so a reader following the docs never finds `/models`.

**It is not sweep damage.** `src/commands/` was created by the original feature commit,
`7e23226 feat(models): model picker /models list|pull|use`, and backlog item 1's sweep then split
`/models` into one-function-per-file **in place** (`f08c47c`) rather than relocating it. The sweep was
measuring declaration counts per file; a directory in the wrong place is invisible to that instrument,
which is the same shape of blind spot as [item 32](two-unrelated-types-named-phase.md).

## The worse half: `src/commands/run.ts` is the `/models` dispatcher

```
src/commands/run.ts            → export async function run(ctx)   // dispatches /models <sub>
src/interface/commands/run.ts  → export const runCommand: Command // IS the /run command
```

Two files named `run.ts`, in two directories, and **the one that is not `/run` is the one named after
it.** Its own header says *"The `/models` dispatcher"*, so the file name contradicts the file's first
line of prose.

This is a violation of the one-function-per-file rule **as the constitution actually words it** —
*"The kebab-case file name names that function's job"* — and it is the case that shows why the rule
cannot be checked mechanically. `run.ts` declaring `run` is an **exact** name-to-filename match, so
every automated census passes it. Only the job disagrees. See
[item 36](naming-half-of-one-function-per-file-unmeasured.md), which is that gap stated on its own.

## Decisions, open — the user's

- **Does `/models` move to `src/interface/commands/`, or does the layout doc gain `src/commands/`?**
  Moving is 7 files plus one import in `command-registry.ts`; documenting is one line. Moving is the
  answer that makes the two directories one, but *which* answer is a call about what `src/commands/`
  was meant to be.
- **What is the dispatcher renamed to?** `run-models.ts` keeps the verb, `dispatch-models.ts` names
  the job, `models-dispatch.ts` sorts beside `models.ts`. Any of the three ends the collision.
- **Is `models.ts` beside a dispatcher right at all?** `models.ts` holds the command object and the Tab
  candidate list, and its header asks the next reader to *"keep it and the switch below in step"* — two
  files that must be edited together, which is the smell the rule usually catches.

## Why it sits where it does

Small and mechanical once the names are chosen, and it touches files
[item 6](boot-can-pick-a-toolless-model.md) is editing right now. **It was deliberately kept out of
item 6**: a directory move buried inside a feature PR is exactly the diff that should not ride inside
somebody else's commit, and item 6's agent was told to leave the location alone for that reason.
