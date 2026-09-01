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

- **Once top-level inline arrows count as well, it is 104 files and 504 declarations.** **19** arrow
  properties qualify. Five files join on their account: `interface/commands/audit.ts`,
  `interface/commands/new-project.ts`, `interface/commands/swap.ts`, `interface/commands/tasks.ts` and
  `tools/debate.ts`.

  An earlier count said 106 / 528 and seven files. It counted arrow properties wherever they appeared;
  only those on an object literal **at module top level** are declarations. Ten files hold arrows inside
  a function body — `run.ts` 8 of its 9, `renderer.ts` all 3, `repl.ts` 3, `context.ts` 2, and one each
  in `orchestrator.ts`, `retro-runner.ts`, `reviewer-runner.ts`, `subagents.ts`, `worker-runner.ts` and
  `ollama-with-signal.ts` — **22 arrows in all**. Two of the seven, `subagents.ts` and
  `ollama-with-signal.ts`, leave the violation list entirely as a result.

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
  raw regex hits at the baseline were this;
- **the subtlest one** — an arrow on an object a function **builds and returns**. `renderer.ts`'s
  `assistantStream()` returns `{ push: (delta) => …, end: () => …, interject: (block) => … }`; that is a
  closure-based handle, and its arrows are the function's implementation exactly as a local would be.
  The dodge the user closed was a file moving its **top-level** functions into an exported object
  literal — `swap.ts` — which is a different thing. **22 of the 41 raw property-arrows at the baseline
  are inside a function body**, so getting this wrong overstates the work by more than half the arrows.

**A class's methods do not count either.** A class is one declaration however many methods it carries,
for the same reason locals do not count: the methods are its implementation. That leaves a known hole —
free functions moved onto a class score one instead of many — and it is **accepted rather than closed**.
Do not invent a class to duck the bar; nothing in the counter will stop you, and the reviewer will.

Scoped this way the bar is measurable: **19** qualifying arrow properties repo-wide at the baseline. The
repo has **zero** top-level arrow consts — that clause costs nothing today and is in the bar only to keep
the obvious way around it closed.

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

**An assembler is not only for files born holding an object.** A module already consumed as a single
namespace — `import * as renderer` — *is* the thing the rule describes, and turning it into an assembler
keeps every call site byte-identical because callers already write `renderer.paint()`. Only the one
import line moves. This is the second time the rule has been reached for by a file that did not already
export an object, so it is written down: **when a directory's files are consumed as a namespace, the
assembler is the expected shape, not a special case.** The six `core/ui` singletons — `renderer`,
`status-bar`, `input-fence`, `status-activity`, `activity-line`, `message-queue` — take it, holding 179
call sites still.

**Singleton state moves to a `<name>-state.ts` value module**, since the functions that shared a
module-private variable no longer share a module. **The cost is real and was accepted knowingly**: six
sets of module-private state become six exported mutable objects, and the invariant that only the owning
assembler's functions write them stops being enforced by the language and starts being enforced by
convention. The alternative offered — threading state as a parameter with the assembler holding it in a
closure — was declined. Each state file's header carries the invariant, because a header is now the only
place it lives.

**An unowned constant gets a vocabulary file named for what it describes.** When a constant has no
single owning function, it goes in its own file named for the thing, not for a consumer —
`tar-format.ts` (3 constants), `status-bar-rows.ts` (2), `input-prompt.ts`, `panel-indent.ts`,
`no-subject.ts`, all created by earlier waves from precedent before this brief said so. Roughly fourteen
more are coming: `BACKLOG_DIRNAME`, `MAX_TOOL_ROUNDS`, `KEEP_RECENT_TOOL_RESULTS`,
`CONTEXT_TITLE_LIMIT`, `MAX_DEBATE_ROUNDS` among them.

**Two near-identical functions are two files when the difference is an invariant, not a flag.**
`sql-int.ts` and `sql-int-or-null.ts` were kept apart deliberately rather than merged behind a boolean.
NULL-means-zero for a `COUNT` and NULL-means-Ollama-reported-nothing are exactly the distinction the
**exact-token invariant** rests on — which `harness-gaps-vs-claude-code.md` lists among the things that
must not be traded away. A flag would have pushed that judgement out to every call site, where it would
eventually be got wrong. When collapsing two similar helpers, ask what the parameter would be *deciding*.

**The corollary matters as much as the rule: a constant with a single owner rides with that owner.**
Only a genuinely shared constant earns its own file. Otherwise the sweep trades one over-full file for a
scatter of one-line modules, which is not what the rule is for.

**Before reaching for the assembler, check whether the colliding helper is a DUPLICATE.** This inverts
the guidance below, and it was earned: `inbox-store`'s private `appendEvent` and `events-log.ts`'s
exported `appendEvent` were heading for two `append-event.ts` in one flat folder — exactly the collision
shape that sent wave B to an assembler. Neither renaming nor an assembler was right. **The private one
was the fourth copy of `append-jsonl-line.ts`**, whose own header says it exists so that "audit.ts and
events-log.ts do not each re-implement the fsync dance". A helper that already had a shared home had
been re-implemented three more times. So the order is: **duplicate? → delete and repoint. Genuinely two
different functions? → then the assembler.** A collision is evidence about the code, not just a file-system
problem to route around.

**A file-name collision is a signal to reach for the assembler — never a licence to rename an exported
name.** In a flat directory, one file per function is sometimes *impossible*: `repaint` is exported by
both `status-bar.ts` and `activity-line.ts`, `reset` by both `input-fence.ts` and `status-activity.ts`.
Later waves will meet this harder — `interface/commands` has 20 files of near-identical shape and
`run`, `complete` and `usage` recur across all of them. Renaming an exported name to dodge a collision
changes the API to satisfy a file system; the assembler is the answer the rule already provides.

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

**Extracting a private helper promotes its name from a local detail to a repo-visible identifier, and
the name must be re-judged at that moment.** This has now bitten twice, in mirror-image ways, and both
times the wave was doing exactly what it was told:

- **`errMessage` / `messageOf` — two names for one behaviour**, caught *after* it landed.
- **`toPosix` — one name for two behaviours**, caught *before* it landed. The session copy was
  `.replace(/\\/g, '/').trim()`; the two private copies in `src/tools/` are
  `.replace(/\\/g, '/').replace(/\/+$/, '')`. **Neither is a superset of the other** — one trims
  whitespace and keeps trailing slashes, the other strips trailing slashes and keeps whitespace. While
  both were private that was invisible; extracted, they become same-named files in sibling directories.

> **RULING: both get renamed, and half of it is done.** Wave C renamed the session half to
> `src/core/session/to-posix-trimmed.ts` / `toPosixTrimmed`, whose header records why.
> **`src/tools/` still owes the other half, and wave D owns it**: `commit-changes.ts:24` and
> `git-inspect.ts:30` hold the two copies, identical to each other, and both must lose the name
> `toPosix` for one that says what they do. **Do not resolve this by making one import the other** —
> they are different functions that were never the same function, and `commit-changes.ts:43` already
> writes `toPosix(entry.trim())` to make up the difference at the call site.

> **RULE — grep before you name.** Before a private helper becomes a file name, **grep the other
> directories for that name.** It costs one command and it is the only moment the collision is cheap.
>
> **A clean grep is not permission to skip the read.** The rule's real purpose is to make you *look at
> the name*; catching a collision is the cheaper half. `memory-db.ts`'s split grepped 15 helpers, found
> **zero** collisions, and renamed **eight of them anyway** — `sqlText`, `sqlIntOrNull`,
> `toMemoryRecord`, `messageInsertParams` — because a name that was adequate as a local detail is often
> not adequate as a file name a stranger reads first. Zero hits means keep reading, not move on.
> Then apply the sequence: **a duplicate → delete it and repoint.** **Genuinely different → rename the
> newcomer**, leaving the plain name with whoever already had it.

Three data points in one sweep, which is what makes this a rule rather than an anecdote:

| name | what it turned out to be | resolution |
|---|---|---|
| `appendEvent` | a **duplicate** — the fourth copy of `append-jsonl-line.ts` | deleted, callers repointed |
| `splitFrontmatter` | **different bodies**: `context/`'s takes one argument, returns `{name, body}`, never throws; `backlog.ts`'s took the task path for its error message, returned `{data, body}`, threw `BacklogError` | newcomer renamed `splitTaskFrontmatter`; `context/` kept the plain name it already had |
| `toPosix` | **different bodies**, neither a superset | session half renamed `toPosixTrimmed`; `src/tools/` still owes its half to wave D |

**A shared destination is created once, by the first wave that needs it, and named here before a second
wave can invent a rival.** This rule has a scar. `b63092e` committed
`src/core/container/message-of.ts`, and the `commands` wave then wrote `src/core/err-message.ts` with
the identical body — one function, two homes, because neither wave knew the other was writing it. **The
ruling is `src/core/err-message.ts`**; the container copy is deleted and repointed in a follow-up. Worth
knowing before anyone re-opens it: `messageOf` is the *dominant* spelling by a distance — 14 files at the
baseline, 16 now, against 2 — **and it lost anyway.** Frequency is not the argument.

**The barrel invariant: its line count may grow, its NAME SET may not.** Splitting a source file turns
one `export { a, b, c } from './x.js'` into three one-name lines. That is unavoidable — ESM has no other
way to say it — and it is **not** what the prohibition covers. What is forbidden is **minting a
re-export for a newly created file**, which adds a name the barrel never carried.

State compliance as the invariant, because it is the thing that is actually checkable: **the set of
names a barrel exports must be identical before and after your commit.** Wave C proved its git-family
split that way — 91 exported values and 77 exported types, name for name against `HEAD` — having created
`push-remote.ts`, `has-head.ts`, `porcelain-path.ts` and a dozen more and given **none** of them a
barrel entry. A newly created file gets a **direct import** from its callers. `src/core/err-message.ts`
and `src/core/ui/write.ts` got none, and neither did anything in `src/boot/`.

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

> **RULING, third and final revision — read this before writing any type.** An unowned type gets **its
> own file: one type per file, named `<kebab-type-name>.type.ts`.** `blocker-row.type.ts`,
> `phase-load.type.ts`, `tool-call-display.type.ts`. **`types.ts` no longer exists as a concept**, and
> neither does the "one mandated spelling per folder" clause it needed, nor the rationale that had
> `review-types.ts` merging into it.

**What did NOT change, and it is the rule most of this work rests on: a type WITH an owning function
stays inside that function's file.** `InstalledModel` stays in `list-models.ts`. Everything five waves
have already folded in stays folded in. Only the **unowned** types — the ones that were collecting in a
folder's `types.ts` — are affected. Three type rulings have now landed in one session, which is exactly
where a reader loses the thread, so: **owned types have never moved.**

**`<name>.type.ts` is back, and it means something different from what it used to.** It once named a
**sibling** of a function file — a `<name>.ts` / `<name>.type.ts` pair. It now names a **standalone
module holding exactly one unowned type**, with deliberately **no `.ts` file of the same stem**. Do not
recreate the old pairing; a type that has a function to sit beside belongs *inside* it.

**Retrofit, not forward-only — and scheduled, not now.** All five surviving `types.ts` files split:
`core/session` (26 declarations), `tools` (9), `core/llm` (6), `core/ui` (5), `core/container` (3). The
user chose retrofitting over leaving them, so the repo ends with one convention rather than a reader
having to know which era a folder was swept in. **It is its own wave after C**, because the three
finished directories collide with live work: `core/ui/types.ts` alone has six importers outside its
folder — `dispatch.ts`, `retro-runner.ts` and `turn-loop.ts` in `core/session`, where wave C is running,
plus `build-file-diff.ts`, `write-file.ts` and `tools/types.ts`. That last one means the `core/ui` and
`tools` retrofits are themselves coupled. **`tools`' share folds into wave D.**

**Wave C's type-family tie-breaker is retired, not confirmed.** It existed because splitting `BlockerRow`
from `RaisedBlocker`/`ResolvedBlocker` would have made `types.ts` import from a function file. Under
one-type-per-file the union and its members are simply three files and the union imports the other two.
**Types importing types is fine**, and nothing about the rule argues for keeping a family in one module.

**Second worked example for the barrel invariant.** A single `types.ts` export line becomes 26 one-name
lines. The line count grows; **the exported name set is identical.** That is the check.

**Worked example — `src/tools/search-in-files.type.ts`.** It has a sibling, so it looks like a mechanical
fold, but its 8 declarations serve five peer functions (`find-matching-lines`, `merge-line-ranges`,
`parse-search-request`, `render-file-matches`, `summarize-search`) and none of them owns the
request/result vocabulary. It is the orphan case wearing a sibling's clothes: under the ruling above its
declarations become **eight `<name>.type.ts` files**. Do not agonise over which of the five functions
should host it — that question is itself the signal that no function owns it.

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
| `src/core/session` | 28 | 181 |
| `src/interface/commands` | 20 | 103 |
| `src/core/ui` | 14 | 77 |
| `src/tools` | 20 | 60 |
| `src/interface` | 7 | 28 |
| `src/core/container` | 4 | 17 |
| `src/core/llm` | 4 | 13 |
| `src/context` | 4 | 11 |
| `src/commands` | 1 | 9 |
| `src/` (root — `index.ts` itself) | 1 | 3 |
| `src/phases` | 1 | 2 |

Eleven rows, summing to the **104** files and **504** declarations above — functions, classes and
top-level inline arrows together, which is the bar as it now stands.

**Two rows have no wave assigned, and both are easy to lose.**

- **`src/` (root)** is `src/index.ts`. It is exempt from barrel deletion but not from the split, so
  whoever takes it extracts `fail`, `resolveOrExit` and `main` and leaves the entry point holding its
  imports and the `main().catch(...)` call. It has no directory of its own.
- **`src/phases`** entered the table only when classes began to count: `resolve-phase-tools.ts` holds
  one class beside one function. It is a single small file, which is exactly why nobody will notice it
  is unowned.

Neither can be assumed to belong to whoever is nearby. **Assign both deliberately.** Both now are:
`src/index.ts` to its own agent in wave C, `src/phases` to wave D riding with `tools`.

### The wave plan

Recorded here rather than held by whoever is coordinating, so it survives a handover.

| wave | who | files / decls | why this shape |
|---|---|---:|---|
| **A** | `core/llm`, `core/container`, `context`, `commands` — four agents | 13 / 50 | the quiet corners: 1, 1, 2 and 1 files reached from outside, no overlap |
| **B** | `core/ui` — one agent, alone | 14 / 77 | the hub: 26 files reached deeply from five directories |
| **C** | `core/session`; `src/index.ts` — two agents | 29 / 184 | the largest directory in the repo, several commits; root is nearly free |
| **D** | `tools`+`phases`; `interface`+`interface/commands` — two agents | 48 / 193 | each pair is mutually coupled, so one owner each |
| **E** | the final barrel pass — one agent | 9 barrels | all nine `index.ts` re-export modules deleted at once, after every directory is final |

**Why a pair is a pair and not two agents.** `interface` ↔ `interface/commands` is mutual, and
`phases` imports from `tools`. Splitting either pair across two agents puts both of them in the same
files. One owner per pair is not a convenience — it is the only shape that avoids the contention the
partition exists to prevent.

> **THE LESSON THAT COST THROUGHPUT: re-measure the coupling at the start of every wave. Never inherit
> it from this plan.** The import graph **changes as directories complete** — a split retires deep
> edges, a barrel absorbs others — so a posture that was correct when the plan was written goes stale
> underneath it. Waves C and D were held more serial than the graph required for exactly that reason,
> and the cost was real. The plan above is a **starting point, not a schedule.**

**What the graph actually said when re-measured after five directories had landed** — and every one of
these was more parallel than the plan assumed:

- **`core/session` and `interface` have ZERO deep edges in either direction.** They can run at the same
  time. (Both do import each other's *barrels*, which is precisely why the barrels survive to wave E:
  a barrel absorbs a split so its importers never see one.)
- **`phases`, `core/llm/types.ts` and `core/container/types.ts` are fully self-contained** — 9 and 3
  importers respectively, every one inside its own directory. One agent can hold all three.
- **Only three genuine blockers remain:** `core/session` ↔ `tools` (mutual, 17 and 10 files),
  `interface` ↔ `interface/commands` (15 and 1), and the `core/ui/types.ts` retrofit.
- **`tools/types.ts` rides with the `tools` wave.** 50 importers, but **exactly one** outside its own
  directory (`core/session/dispatch.ts`).

**The concurrency ceiling is about four agents.** Past that the blockers above bind and agents start
waiting on each other rather than working.

**One correction to the blocker list, measured rather than assumed.** The `core/ui/types.ts` retrofit
was recorded as having to run **alone and last**, reaching `interface/commands`, `core/session`, `tools`
and `interface`. It does not. The module has **15 importers: 9 inside `core/ui`, 3 in `core/session`
(`dispatch.ts`, `retro-runner.ts`, `turn-loop.ts`) and 3 in `tools` (`build-file-diff.ts`,
`write-file.ts`, `types.ts`) — and none at all in `interface` or `interface/commands`**, by import or by
type-name usage. It conflicts with `core/session` and `tools` only, and **can run beside the
`interface` pair.**

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

**The discipline has now been tested by accident, and it held.** Two live agents were killed mid-task by
a session limit. The tree needed **no recovery of any kind**: nothing was staged, no scratch files sat
inside the repo, and every commit had been made by explicit pathspec, so no half-finished work was
reachable by anyone else's `git add`. Nobody designed the partition rules for that failure mode — they
were aimed at two agents editing one file — but *never stage speculatively, keep scratch out of the tree,
and always commit by pathspec* is exactly what makes an agent's sudden death cost nothing. Keep doing all
three even when you are the only one working.

## Hazards found during the first increment

- **A differential harness whose baseline imports only types proves nothing.** `tsx` **strips
  type-only imports**, so a baseline that imports nothing but types from the module under test keeps
  compiling and passing after that module has moved or been deleted — green, and worthless. Wave C's
  `verify-backlog` baseline did exactly this and only broke honestly because `TASK_STATUSES` is a
  runtime value. **Every remaining wave builds one of these harnesses, so: a differential baseline
  must import at least one runtime value from the module under test, or its green result is not
  evidence.** Check that before trusting a byte-identical comparison.
- **The same trap's second shape: when a probe depends on a fixture being in a particular state, prove
  the fixture is in that state.** A migration probe is the worked example. `addCancelledAtColumn`
  early-returns on every fresh database, because `memory-db.schema.ts` already carries `cancelled_at` —
  so the naive probe opens a new database, migrates nothing, and reports green. Wave C hand-built a
  **pre-migration** database and then wrote **a separate check proving the builder had produced one**:
  column absent before the open, present after. Without that second check the probe passes while
  starting from an already-migrated schema, which is the same worthless green as the type-only baseline
  one entry above.
- **False red teaches nothing, and it has two known shapes.** Ten probes in the `memory-db` split were
  red for reasons that were not behaviour: a dump ordered `BY id` where the ids are **random UUIDs**,
  and a comparison against a query whose `ORDER BY last_at DESC` had **ties the seed data created**,
  which SQLite breaks arbitrarily. The danger is not the wasted time — it is that the obvious next move
  is to "fix" the code until it matches the harness, encoding an artefact of the fixture as behaviour.
  **Order by something total and deterministic, and make the seed data tie-free.**
- **`import 'dotenv/config'` must stay the FIRST import in `src/index.ts`.** ESM evaluates a module's
  imports in source order, so being first is what guarantees the whole boot subtree sees a populated
  `process.env`. Move it below `./boot/main.js` and `OLLAMA_NUM_CTX` reads `undefined` **with no error
  at all** — every window silently runs at Ollama's default ceiling instead of the pinned one. The
  entry point states it in a comment, and **that is deliberately where it stays.** A one-file
  source-structure test was offered and declined: this repo states every other ordering constraint the
  same way, and a suite that polices file layout rather than behaviour is a different instrument from
  the one item 2 built. Do not re-propose it.

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

Two items are outstanding, and one that was listed here has been **withdrawn**:

- **Tests for `StreamFilter` and `recoverToolCalls`** — item 2 deferred them while `core/llm` was
  mid-split. That directory has landed, so they are unblocked.
- **Tests for `src/context/`** — likewise deferred; the directory landed in `daf08cf`.
- ~~`src/core/llm` needs a follow-up for `ollama-with-signal.ts`~~ — **withdrawn, and worth knowing why.**
  It read as one function plus an inline arrow, but the arrow is `fetch: (input, init) => {` on the
  object passed to `new Ollama({…})` **inside the function body**. Under the corrected rule that is not
  a declaration. `core/llm` is complete and owes nothing. The entry survives struck rather than deleted
  because the mistake is instructive: the arrow rule was applied before it was scoped.

## Order

**Ships before [budget-ceilings-for-runs-and-batches.md](budget-ceilings-for-runs-and-batches.md)** so
the new budget resolver is written into the shape that already exists rather than added to an exception
and moved afterwards. That half is satisfied by the first increment: the shape exists now. At the widened
scope the sweep also relocates functions that items 2, 5, 6 and 7 test, move or add to, so it stays
first.
