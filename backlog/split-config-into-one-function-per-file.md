# One function per file, across `src/`

**Category:** Repo hygiene

Item 1 of the execution order. It began as a two-file refactor and is now the repo-wide sweep that makes
the constitution's *one function per file, least responsibility* rule true rather than aspirational.
**The first increment has shipped; the sweep has not.** This file stays until it does.

## What has already landed

`src/core/session/config.ts` held four functions — `resolveNumCtx`, `resolveRatio`, `resolveTimeoutMs`
and `loadConfig` — as a deliberate exception for env resolution. From OPEN-QUESTIONS.md **#47**:

> Each function must be on its own file, and the `config.ts` just reexports them inside the config
> object.

Done. Each resolver holds `resolve-num-ctx.ts` / `resolve-ratio.ts` / `resolve-timeout-ms.ts`, the
assembly holds `load-config.ts`, and `config.ts` keeps the `DEFAULT_*` constants and re-exports the four.
`loadConfig(projectName)` is still the entry point and nothing outside `core/session/` changed.

`src/core/llm/ollama-models.ts` (#94a) went the same way and no longer exists: `list-models.ts`,
`has-model.ts`, `pull-model.ts`, and the shared `daemon` client — a value, not a function — in
`daemon.ts`. Its cohesion-arguing header is gone; it lost the argument `config.ts` lost.

## The claim that was wrong

#94's answer closed with *"After it, no multi-function files remain in `src/`."* **That was never true.**
A census of the tree after the first increment:

- **213** code files under `src/` (excluding `.type.ts` and `.schema.ts`).
- **96** of them declare more than one function, holding **464** functions between them. The first
  census said 95 and 461: it excluded every `index.ts`, which hid `src/index.ts` and its three
  functions (`fail`, `resolveOrExit`, `main`). No other `index.ts` declares a function.
- **27** export more than one — worst: `memory-db.ts` 11, `renderer.ts` 10, `project-git.ts` 8,
  `backlog.ts` 8, `status-bar.ts` 7, `status-activity.ts` 6, `project-git-stash.ts` 6,
  `project-git-branch.ts` 6.

`config.ts` and `ollama-models.ts` were not the only violations. They were the only two that had
*written the exception down*, which is why they were visible and the other 93 were not.

## The bar

**Any function declaration counts, not just an exported one.** A private helper is a second function and
means a second file. This is not a new severity: `config.ts`'s three resolvers were never exported, and
that is precisely what made it a violation. Judging by exports instead would leave 68 of the 95 files
untouched while claiming the rule holds.

Not violations, and not to be "fixed":

- an **assembler** that composes the extracted functions into one object value — but see the next
  section, which narrows this sharply;
- a file that holds only **constants** (the new `config.ts`);
- a file that holds only a **value** (the new `daemon.ts`).

## What happens to the file that was split

**It survives only if it assembles the parts into an object.** The ruling, in the user's words: *"Only
keep a barrel if the barrel is exporting an object with functions inside. Otherwise, delete immediately
and update the imports."*

An assembler composes the extracted functions into **one object value** that callers use as a single
thing. A file that would survive merely by listing the names again — `export * from`, or
`export { a, b, c }` — is **not** an assembler. **Delete it and repoint every importer, in the same
commit.**

**A re-export barrel left behind is not an acceptable intermediate state, even temporarily.** A
barrel-then-cleanup two-pass was put to the user precisely because it would have let all nine directories
run in parallel: each agent splits its own files, leaves a barrel so nothing outside breaks, and a final
pass deletes the barrels. It was declined with that trade understood — the stricter end state is worth
more than the parallelism. Do not re-invent it as a local shortcut.

## The directory `index.ts` barrels go too

No carve-out for a directory's public interface. Every pure re-export module is deleted and every import
becomes a direct path to the file that owns the function. The cost was put to the user explicitly — the
117 cheap through-barrel imports all become deep ones, and each later wave is bigger for it — and taken
anyway.

**All nine were checked and every one is a pure re-export**; none composes an object, so the assembler
rule saves none of them. If a future check finds one that does compose an object, it survives — report
it rather than deleting it.

| barrel | export lines | files importing it |
|---|---:|---:|
| `src/core/session/index.ts` | 66 | 17 |
| `src/tools/index.ts` | 39 | 5 |
| `src/core/ui/index.ts` | 32 | 0 |
| `src/core/llm/index.ts` | 20 | 22 |
| `src/core/container/index.ts` | 9 | 7 |
| `src/context/index.ts` | 7 | 9 |
| `src/phases/index.ts` | 5 | 5 |
| `src/interface/index.ts` | 2 | 1 |
| `src/core/index.ts` | 1 | 0 |

`src/core/ui/index.ts` has 32 exports and **no importers at all** — everything already reaches into
`core/ui` deeply, which is the same fact as the 26 distinct deep-import files counted below. Deleting it
costs nothing. `src/core/index.ts` is likewise unused.

**`src/index.ts` is NOT one of the nine and must not be deleted.** It has zero export lines: it is the
application entry point, not a barrel, and it survives on those terms. It does still hold three
functions (`fail`, `resolveOrExit`, `main`), so the sweep extracts those into their own files and leaves
`src/index.ts` holding its imports and the `main().catch(...)` call — no functions, which the rule
allows.

**Sequencing — reversed, and the reason matters. Barrels survive every sweep wave, and all nine are
deleted in one dedicated final pass once every directory has been swept.** The user's ruling is
unchanged — the barrels die. Only the timing moved.

**A sweep agent updates its own directory's `index.ts` in place and never deletes it.** Its splits change
what the barrel points at, so the barrel's lines move with them. That is the whole of a wave's dealing
with barrels.

The first plan was to delete each barrel in its own directory's wave, and the import graph says that is
wrong. `src/tools/context.ts` imports both `core/llm/index.js` and `core/container/index.js`; and
`tools/edit-phase-rule.ts`, `tools/read-phase-rule.ts` and `tools/search-rules.ts` each import both
`core/llm/index.js` and `context/index.js`. Deleting barrels per wave would put three parallel wave A
agents into the same files in `src/tools` — a directory none of them owns, and one not swept until much
later.

Keeping the barrels inverts that completely. The outside fan-in per wave A directory becomes:

| directory | files outside it that need touching |
|---|---|
| `src/core/llm` | none |
| `src/core/container` | `src/tools/run-in-project.ts` |
| `src/context` | `src/phases/factory.ts` |
| `src/commands` | `src/interface/command-registry.ts` |

No overlap, so those four agents run cleanly in parallel. The original double-rewrite objection — that
deleting a barrel repoints importers at files the sweep is about to split, so every such import is
rewritten twice — applies to deleting them **first**. Deleting them **last** carries no such cost,
because by then every file is final. This has now been measured twice; do not re-derive it.

*A wording note, so nobody trips on it.* [constitution.md](../constitution.md) says a re-export barrel
left behind is "not an acceptable intermediate one". That sentence is about a **split file** leaving a
re-export shell of itself behind — the vestige of a file that has stopped having a reason to exist. The
nine directory barrels are a different, pre-existing category: they go on serving their importers right
up until the final pass deletes them. They are not the intermediate state of anything.

## The type reversal rides along

The constitution used to require types in a sibling `<name>.type.ts`. **That rule is reversed:** a type
lives in the file that owns the function it describes. **55** sibling type files fold in as the sweep
reaches them. Classified by who imports them:

- **29 mechanical** — nothing but their own sibling and a barrel imports them. Move the declaration up
  into the sibling, retarget the barrel line, done.
- **21 shared** — imported by files beyond their sibling. Still mechanical, just wide: each importer
  changes one path. Widest are `read-tracker.type.ts` (8 importers) and `memory-db.type.ts` (5).
- **5 orphans** — **no `.ts` sibling at all**, so no function owns them. These are the ones that bite:

  | file | non-barrel importers |
  |---|---|
  | `src/core/ui/tool-call-display.type.ts` | 6 — `dispatch.ts`, `retro-runner.ts`, `build-file-diff.ts`, `write-file.ts`, `types.ts`, `format-tool-result-lines.type.ts` |
  | `src/core/llm/call-role.type.ts` | 3 — `client.ts`, `one-shot.ts`, `resolve-window-ctx.ts` |
  | `src/core/ui/markdown-stream.type.ts` | 3 — `turn-loop.ts`, `create-markdown-stream.ts`, `renderer.ts` |
  | `src/core/container/tar-entry.type.ts` | 2 — `encode-tar.ts`, `sandbox.ts` |
  | `src/core/container/sandbox-file.type.ts` | 1 — `sandbox.ts` |

**Ruled: a type no function owns goes in the folder's `types.ts`.** Not into an arbitrary function's
file — `write-file.ts` holding a display contract six other files import would be worse than what exists
today. The reasoning is the one the one-function-per-file rule already uses: *cohesion is an argument for
a folder, not for a file*, and that holds for types exactly as it holds for functions. The shape is not
new — `src/tools/types.ts` (9 declarations), `src/core/session/review-types.ts` (5),
`src/core/session/types.ts` (4) and `src/core/llm/types.ts` (3) already do this and predate the rule.

**`types.ts` is the mandated spelling, one per folder.** `review-types.ts` is a second spelling of the
same idea and merges into `src/core/session/types.ts` when the sweep reaches that directory.

So the five orphans go to `src/core/ui/types.ts`, `src/core/llm/types.ts` and
`src/core/container/types.ts`. This also keeps `CallRole` addressable at a stable path, which is what
lets `docs/mental-model.md:27` keep linking to a file — see the hazards below.

**Worked example — `src/tools/search-in-files.type.ts`.** It has a sibling, so it looks like a mechanical
fold, but its 8 declarations serve five peer functions (`find-matching-lines`, `merge-line-ranges`,
`parse-search-request`, `render-file-matches`, `summarize-search`) and none of them owns the
request/result vocabulary. It is the orphan case wearing a sibling's clothes: **it goes to
`src/tools/types.ts`.** Do not agonise over which of the five should host it — that question is itself
the signal that no function owns it.

`.schema.ts` siblings **stay**. A type erases at compile time and costs the function file nothing; a
schema is a runtime value with its own weight and its own imports. There is one in the repo,
`memory-db.schema.ts`, and it is a block of SQL DDL.

## Before any sweep work begins

**`constitution.md` and `CLAUDE.md` currently state the opposite of both rules above.** The amendment is
drafted in the working tree and is review-gated — it is never auto-committed (constitution, *Instruction
integrity*). **It must be reviewed and committed by the user before the first sweep commit**, or the
sweep implements a rule the docs contradict.

## Why the sweep is mostly sequential

Because deleting a split file edits files in other directories. Measured over `src/`:

- **641** same-directory imports — free; they move with their own directory.
- **117** cross-directory imports that go through a directory's `index.ts` barrel — cheap; the barrel
  line changes and the importer does not.
- **168** cross-directory imports that reach **past the barrel straight into a file**. These are what
  stop directory-owned agents from running in parallel.

Counted as *distinct target files reached from outside* — the number that matters, because those are the
files that cannot be split without editing another directory in the same commit:

| from | to | files reached |
|---|---|---:|
| `core/session` | `tools` | 18 |
| `interface` | `interface/commands` | 15 |
| `tools` | `core/session` | 15 |
| `core/session` | `core/ui` | 11 |
| `interface` | `core/ui` | 9 |
| `interface/commands` | `core/ui` | 9 |
| `phases` | `tools` | 7 |
| `commands` | `core/ui` | 5 |
| `tools` | `core/ui` | 5 |
| `interface/commands` | `interface` | 4 |

**`core/ui` is the hub and cannot share a wave with anything.** 26 distinct files in it are reached
deeply from five other directories, across 39 directory-to-file edges — the two figures differ because a
file reached from three directories counts once as a file and three times as an edge.

`core/llm`, `core/container` and `context` are the quiet corners, with 1, 1 and 2 files reached from
outside. They are the only directories that could safely run beside another wave.

## The partition

Multi-function files and the functions inside them, per directory:

| directory | files | functions |
|---|---:|---:|
| `src/core/session` | 27 | 172 |
| `src/interface/commands` | 16 | 84 |
| `src/core/ui` | 14 | 77 |
| `src/tools` | 19 | 58 |
| `src/interface` | 7 | 28 |
| `src/core/container` | 4 | 16 |
| `src/core/llm` | 4 | 11 |
| `src/commands` | 1 | 8 |
| `src/context` | 3 | 7 |
| `src/` (root — `index.ts` itself) | 1 | 3 |

Ten rows, summing to the **96** files and **464** functions counted above. The root row is
`src/index.ts`: it is exempt from barrel deletion but not from the split, so whoever takes it extracts
`fail`, `resolveOrExit` and `main` and leaves the entry point holding its imports and the
`main().catch(...)` call. It has no directory of its own, so it must be assigned deliberately rather
than assumed to belong to whoever is nearby — it is the last file in the tree anyone would notice was
missed.

## Do not update the progress ledger

`backlog/README.md`, and item 1's entry in it, is the single record of the sweep's progress — and **one
agent owns it.** A sweep agent does **not** edit it, not even to tick off its own directory: four agents
editing one index is precisely the contention the per-directory partition exists to avoid. Report a
one-line status instead and it will be folded in for you.

The same goes for this brief. If you find something in it wrong or missing — and the first increment
found the last three such things — **report the correction rather than applying it.**

## Hazards found during the first increment

- **`docs/mental-model.md:27` links `src/core/llm/call-role.type.ts` by path.** `CallRole` moves to
  `src/core/llm/types.ts`, which is a stable path, so **retarget the link there** in the same change that
  moves the file. `docs/` is governance-gated: that edit is handed to the user for review, never
  committed by the agent that makes it.
- **`backlog/README.md`'s item 1 pointer** has been retargeted to this file's new title; the edit is in
  the working tree and rides along with the first sweep commit rather than getting a commit of its own.

## Owed: `config.ts` must become a real assembler

**The shape on `main` in `a0e9e31` does not satisfy the rule it will be judged by.** It keeps the six
`DEFAULT_*` constants — fine on its own — but it also carries four re-export lines, which is exactly the
form the assembler rule rejects.

Ruled, in the user's words: *"config.ts must be a object with functions and the constants inside,
exporting only this object."* So it exports exactly one thing: an object carrying the `DEFAULT_*`
constants **and** `loadConfig` **and** the three resolvers. Every importer moves to it. This knowingly
overrides the literal wording of OPEN-QUESTIONS **#47** (*"the `config.ts` just reexports them inside
the config object"*), which was answered before the assembler rule existed.

**This lands in `core/session`'s sweep wave, not before it.** Recorded here so it is not lost.

Two things whoever writes it needs to know, both already driven against Node's ESM loader rather than
reasoned about:

1. **The cycle survives the reshape, under one condition.** Four entry orders were probed on a
   faithful model of the new shape — entering at the object, at a resolver, at `load-config`, and via a
   dynamic import — and all four resolve correctly. The condition is that a module inside the object's
   own dependency subtree must read `config.CONSTANT` **inside a function body**. The failing shape was
   driven too, and it fails loudly: a top-level `const CAP = config.N` in a module the object imports
   throws `ReferenceError: Cannot access 'config' before initialization`. Call-time read, always.
2. **`SessionConfig` cannot live inside the object.** A type is not a property of a value, so it stays a
   declaration in `load-config.ts` while the value comes from `config.ts`. Callers then take the type
   from one file and the value from another for a single concept. **This is worth a decision rather than
   a default** — see the note below.

### The one open question left

`SessionConfig`'s split import surface. Options: leave it in `load-config.ts` (the function that builds
it owns it, per the type rule); or move it to `src/core/session/types.ts` on the grounds that the config
vocabulary is now folder-level; or accept the split as the unavoidable cost of a value-only export.
Nobody has ruled on it. **Ask before writing the reshape.**

## Order

**Ships before [budget-ceilings-for-runs-and-batches.md](budget-ceilings-for-runs-and-batches.md)** so
the new budget resolver is written into the shape that already exists rather than added to an exception
and moved afterwards. That half is satisfied by the first increment: the shape exists now. At the widened
scope the sweep also relocates functions that items 2, 5, 6 and 7 test, move or add to, so it stays
first.
