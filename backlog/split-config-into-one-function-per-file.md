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

- **213** code files under `src/` (excluding `.type.ts`, `.schema.ts`, and anything under
  `__tests__` — see the test-file rules below).
- **96** of them declare more than one function, holding **464** functions between them. The first
  census said 95 and 461: it excluded every `index.ts`, which hid `src/index.ts` and its three
  functions (`fail`, `resolveOrExit`, `main`). No other `index.ts` declares a function.
- **27** export more than one — worst: `memory-db.ts` 11, `renderer.ts` 10, `project-git.ts` 8,
  `backlog.ts` 8, `status-bar.ts` 7, `status-activity.ts` 6, `project-git-stash.ts` 6,
  `project-git-branch.ts` 6.
- **Once a `class` counts as a declaration too, it is 99 files and 482 declarations.** Only **three**
  files join the list on that account — `src/context/load-prompt.ts`, `src/core/session/orchestrator.ts`
  and `src/phases/resolve-phase-tools.ts`, each one class beside one function. The other 16 of the 19
  classes in the tree either sit alone in their file, which conforms, or sit in a file that was already
  violating.

- **Once inline arrows count as well, it is 106 files and 528 declarations.** 41 arrow properties, 40 of
  them in files already violating. Seven more files join: `core/llm/ollama-with-signal.ts`,
  `core/session/subagents.ts`, `interface/commands/audit.ts`, `interface/commands/new-project.ts`,
  `interface/commands/swap.ts`, `interface/commands/tasks.ts` and `tools/debate.ts`.

> **These figures are the baseline. They are measured at commit `a0e9e31`, before any wave landed, and
> they will NOT reproduce against a live tree** — by wave C, `HEAD` is several swept directories away
> from them. **To re-measure, check out `a0e9e31` and count there.** Counting `HEAD` and finding a
> smaller number is the sweep working, not the census being broken. These numbers are deliberately not
> decremented as waves land; the status reports track what is left.

`config.ts` and `ollama-models.ts` were not the only violations. They were the only two that had
*written the exception down*, which is why they were visible and the other 93 were not.

## The bar

**Any function declaration counts, not just an exported one.** A private helper is a second function and
means a second file. This is not a new severity: `config.ts`'s three resolvers were never exported, and
that is precisely what made it a violation. Judging by exports instead would leave 68 of the 96 files
untouched while claiming the rule holds.

**The complete bar, in one sentence.** A declaration is a top-level `function`, a top-level arrow
const, a `class`, or **an arrow property of an object literal**. Nothing else counts.

**Arrow properties count with no threshold** — `run: (ctx) => showAudit(...)`,
`fetch: (input, init) => {...}`. There is no "small enough" exemption, because the one-declaration bar
already does that work: one arrow in a file is fine, two is a violation, and one beside a function is a
violation. The hole this closes is a file moving its functions into an object literal to score zero,
which is exactly what `swap.ts` does.

**Three things that look like arrows and are not declarations.** Read this before counting, or you will
over-report by a wide margin — nested arrows are everywhere:

- an arrow **local to a function body**: `const onAbort = (): void => iterator.abort();` inside
  `pullModel` is not a second declaration;
- an arrow **passed as an argument**: a callback at a call site declares nothing;
- an arrow in a **type position**: `work: () => T` in a parameter list declares nothing. Four of the 45
  raw regex hits at the baseline were this, which is why the measured figure is 41.

Scoped this way the bar is measurable: **41** arrow properties repo-wide at the baseline. The repo has
**zero** top-level arrow consts — that clause costs nothing today and is in the bar only to keep the
obvious way around it closed.

**A `class` counts as a declaration too** — one class *or* one function per file, never one of each.
The corollary is worth stating because three agents have now reached it independently and each first
reached for the wrong reason: a file holding **only** a class — `client.ts`, `stream-filter.ts`,
`sandbox.ts`, `turn-aborted-error.ts` — conforms **not because a class is exempt**. Nothing exempts a
class. It conforms because it passes the same one-declaration test as every other file.

Not violations, and not to be "fixed":

- an **assembler** that composes the extracted functions into one object value — but see the next
  section, which narrows this sharply;
- a file that holds only **constants** (the new `config.ts`);
- a file that holds only a **value** (the new `daemon.ts`);
- a file that holds only a **class** — one declaration, like any other single declaration;
- anything under `src/**/__tests__/**`, which is exempt outright — see the test-file rules below.

## What happens to the file that was split

**It survives only if it assembles the parts into an object.** The ruling, in the user's words: *"Only
keep a barrel if the barrel is exporting an object with functions inside. Otherwise, delete immediately
and update the imports."*

An assembler composes the extracted functions into **one object value** that callers use as a single
thing. A file that would survive merely by listing the names again — `export * from`, or
`export { a, b, c }` — is **not** an assembler. **Delete it and repoint every importer, in the same
commit.**

**An assembler may export types beside its object.** "Exports that object and nothing else" bounds
*values*, not declarations: a type erases at compile time and costs the import surface nothing, so
`export type { Foo }` next to the object is fine and a second exported *value* is not. This is what
saves 13 of the 16 files in `src/interface/commands/` from deletion — they pair a command object with
the type describing it — and it settles the `SessionConfig` question this brief used to park.

**Duplicated helpers are deduped as the sweep goes, not afterwards.** Two have a home already:
`write` → `src/core/ui/write.ts` and `errMessage` → `src/core/err-message.ts`. **Each later wave
replaces its own copies as it reaches them.** Nobody runs a migration pass across directories
afterwards — that would be one agent editing every other agent's files, which is the thing the
partition exists to prevent.

**A shared destination is created once, by the first wave that needs it, and named here before a second
wave can invent a rival.** This rule has a scar. `b63092e` committed
`src/core/container/message-of.ts`, and the `commands` wave then wrote `src/core/err-message.ts` with
the identical body — one function, two homes, because neither wave knew the other was writing it. **The
ruling is `src/core/err-message.ts`**; the container copy is deleted and repointed in a follow-up. Worth
knowing before anyone re-opens it: `messageOf` is the *dominant* spelling by a distance — 14 files at the
baseline, 16 now, against 2 — **and it lost anyway.** Frequency is not the argument.

**"Update your barrel in place" means repointing lines it already carries. It never means adding one.**
A newly created shared file gets a **direct import** from its callers and no barrel entry.
`src/core/index.ts` re-exports one thing and has zero importers; `src/core/ui/index.ts` has 32 export
lines and zero importers. A new line in either mints a re-export whose only future is to be deleted by
the final barrel pass. So neither `src/core/err-message.ts` nor `src/core/ui/write.ts` gets one.

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

Violating files and the declarations inside them, per directory — **counting classes**, so these are
the numbers to partition on:

| directory | files | declarations |
|---|---:|---:|
| `src/core/session` | 29 | 187 |
| `src/interface/commands` | 20 | 111 |
| `src/core/ui` | 14 | 80 |
| `src/tools` | 20 | 62 |
| `src/interface` | 7 | 31 |
| `src/core/container` | 4 | 17 |
| `src/core/llm` | 5 | 15 |
| `src/context` | 4 | 11 |
| `src/commands` | 1 | 9 |
| `src/` (root — `index.ts` itself) | 1 | 3 |
| `src/phases` | 1 | 2 |

Eleven rows, summing to the **106** files and **528** declarations above — functions, classes and
inline arrows together, which is the bar as it now stands.

**Two rows have no wave assigned, and both are easy to lose.**

- **`src/` (root)** is `src/index.ts`. It is exempt from barrel deletion but not from the split, so
  whoever takes it extracts `fail`, `resolveOrExit` and `main` and leaves the entry point holding its
  imports and the `main().catch(...)` call. It has no directory of its own.
- **`src/phases`** entered the table only when classes began to count: `resolve-phase-tools.ts` holds
  one class beside one function. It is a single small file, which is exactly why nobody will notice it
  is unowned.

Neither can be assumed to belong to whoever is nearby. **Assign both deliberately.**

## `__tests__` is not a sweep target — but it is an importer

Backlog item 2 lands tests under `src/**/__tests__/`, on `node:test` + `node:assert`, in parallel with the
early waves. Two rules follow from that, and they pull in opposite directions:

- **Test files are not sweep targets, and they are not in the census.** The 96 files and 464 functions
  above, and every row of the partition table, count production files only. A test file is many `test(...)`
  calls and may declare helpers besides; one function per file was never aimed at it, and the exemption is
  being written into [constitution.md](../constitution.md) and [CLAUDE.md](../CLAUDE.md) separately. **Do
  not split a test file**, and do not report the census as having drifted when `__tests__` grows.
- **A test file is an importer like any other.** Waves B and C relocate almost every function item 2 pins.
  When you move a function, **update its test's import in the same commit**, exactly as you would any other
  importer. A test left importing a path you deleted is a broken build — and it is broken for the agent who
  deleted the path, not for whoever wrote the test.

## Do not update the progress ledger

`backlog/README.md`, and item 1's entry in it, is the single record of the sweep's progress — and **one
agent owns it.** A sweep agent does **not** edit it, not even to tick off its own directory: four agents
editing one index is precisely the contention the per-directory partition exists to avoid. Report a
one-line status instead and it will be folded in for you.

The same goes for this brief. If you find something in it wrong or missing — and the first increment
found the last three such things — **report the correction rather than applying it.**

**And the same goes for the governance docs.** `constitution.md` and `CLAUDE.md` have **one drafting
owner**, for exactly the reason `backlog/README.md` does. If your work needs a rule changed or clarified
in either file, **report the wording; do not edit the file.** This rule exists because it was once
broken: two agents held uncommitted edits to the same `constitution.md` bullet at the same time, and
nothing was lost only because the second one re-read the file from disk before writing.

Which is the general rule worth stating on its own: **in a shared tree, re-read a file immediately
before you edit it.** Never write it out from your own last-known state — between your read and your
write, someone else may have landed in the same paragraph.

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

### Settled: `SessionConfig` rides along with the object

The question this section used to park — whether a value-only export forces callers to take the type
from one file and the value from another — is answered by the type-export ruling above. **An assembler
may export types beside its object**, so `config.ts` exports the `config` object *and*
`export type { SessionConfig }`. One import site, one concept. `SessionConfig` itself stays declared in
`load-config.ts`, with the function that builds it.

## Open follow-ups

**A directory that looks swept in the table above is not necessarily finished.** Three items are
outstanding:

- **`src/core/llm` is not done, despite `6e1c3f9`.** The inline-arrow ruling landed *after* that wave
  committed, and `ollama-with-signal.ts` still holds one function plus one inline arrow property
  (`fetch: (input, init) => {`) — two declarations. It needs a follow-up pass, and the row above counts
  it as still violating.
- **Tests for `StreamFilter` and `recoverToolCalls`** — item 2 deferred them while `core/llm` was
  mid-split. That directory has landed, so they are unblocked.
- **Tests for `src/context/`** — likewise deferred; the directory landed in `daf08cf`.

## Order

**Ships before [budget-ceilings-for-runs-and-batches.md](budget-ceilings-for-runs-and-batches.md)** so
the new budget resolver is written into the shape that already exists rather than added to an exception
and moved afterwards. That half is satisfied by the first increment: the shape exists now. At the widened
scope the sweep also relocates functions that items 2, 5, 6 and 7 test, move or add to, so it stays
first.
