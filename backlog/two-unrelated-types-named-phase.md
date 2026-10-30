# Two unrelated types are both called `Phase`

**Category:** Repo hygiene

Two different declarations share one identifier:

| declaration | file | what it is |
|---|---|---|
| `export interface Phase { … }` | `src/phases/phase.ts` | the **phase abstraction** — the object a session runs against |
| `export type Phase = 'Discovery' \| 'Design' \| 'Breakdown' \| 'Worker' \| 'Reviewer' \| 'Retro'` | `src/core/session/phase.type.ts` | the **closed set of phase names** — the only valid inbox sender, recipient or resolver |

Nothing is broken. **No file imports both**, so there is no shadowing and no compile error, and the
type-checker has never had an opinion about it. It is a legibility defect: two concepts wearing one name,
in a codebase whose whole convention is that a file's name states its job.

## Why it only became visible now

**A barrel was hiding it.** While the `phases/` and `core/session/` directories each had an `index.ts`,
every consumer wrote `import type { Phase } from '../phases/index.js'` or `'../core/session/index.js'`,
and the folder in the specifier did the disambiguating. Deleting the barrels (backlog item 1's wave E)
made every import name its file, and `phase.ts` beside `phase.type.ts` is where the collision reads
plainly.

It is also, precisely, **the one class of problem an importer census cannot find.** Every measurement in
that sweep resolved import specifiers to files; a duplicated *declaration* imports nothing, so it is
invisible to that instrument. The same blind spot hid a fourth copy of `KeypressListener` for two whole
waves. **This is the second time it has cost something**, which is the argument for the item rather than
a shrug.

## Decisions, open — all of them the user's

- **Which one is renamed?** Both names are defensible and each has a claim. `phases/phase.ts` holds the
  concept the directory is named for, so renaming it makes the directory read oddly. The string union is
  arguably the more specific thing and would take a name like `PhaseName` or `PhaseId` without losing
  anything — but it is the one referenced far more widely, so it is the more expensive rename.
- **Or is neither renamed?** Two types in different directories with no shared importer is a real,
  if minor, cost, and "leave it and let the import path disambiguate" is a legitimate answer now that
  every import names its file. Saying so deliberately is better than leaving it looking like an oversight.
- **Does the union belong in `core/session/` at all?** It mirrors the six `rules/phases/` files, and
  `src/phases/` is the directory that owns the phase concept. That the closed set of phase *names* lives
  under `core/session/` while the phase *abstraction* lives under `phases/` may itself be the thing to
  fix, in which case the rename question answers itself.

## Why it sits where it does

Small, independent, and nothing depends on it. It is filed rather than fixed because **choosing which
name moves is a judgement about what the two concepts are called**, not a mechanical correction — and a
rename touching every consumer of the union is exactly the kind of diff that should not ride inside
somebody else's commit.
