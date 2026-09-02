# Backlog — the order of execution

Every task file in this folder as **one numbered sequence**: what to build, in what order, and for each
item the reason it sits where it does. The two framing notes and the already-shipped work follow the
sequence; neither is part of it.

**This file is not a task and is not deleted when work ships.** It is upkeep: when a task's file is
deleted in the commit that lands it (see [docs/repo-layout.md](../docs/repo-layout.md)), tick and strike
its line here in the same commit. **Numbers are never reused and never renumbered** — a shipped item
keeps its position and the gap is part of the record. The task files remain the source of truth; every
line below is a pointer, never a summary to act from.

Every item is **fully answered** — [OPEN-QUESTIONS.md](../OPEN-QUESTIONS.md) #1–#103, answered in
[ANSWERS.md](../ANSWERS.md), folded into the task files — with one exception in kind rather than in
readiness. **Items 2 and 15 open with a question to the user rather than with code**, and are marked
**⚠ Ask first** where they sit. They are startable; asking is the first step of the work, not a reason
to defer it. Raise the question and wait for the answer before writing anything, because in both cases
the answer can **delete** the task rather than shape it.

---

## The order

### 1. ~~[One function per file, across `src/`](split-config-into-one-function-per-file.md)~~ — shipped

> **SHIPPED.** Measured against `src/`: **0** files holding more than one declaration (from 104 holding
> 504), **0** old-style `.type.ts` pairs (from 50), **0** per-folder `types.ts` (from 3, having peaked at
> 5), **0** directory barrels (from 8), and **0** value re-exports anywhere. `find src -name index.ts`
> returns exactly one path — `src/index.ts`, the entry point. The only re-export left in the tree is
> `config.ts`'s `export type { SessionConfig }`, which the constitution allows as an assembler's type
> ride-along. `tsc --noEmit` clean, `npm test` **400 / 400**, 0 skips.
>
> **The task file survives, and it is the only one that does** — by the user's decision, because it
> stopped being a task file and became the repo's record of *how to verify a refactor*: seven distinct
> shapes of a test that passes while proving nothing, each found by making an instrument fail on purpose.
> The exception is recorded in [docs/repo-layout.md](../docs/repo-layout.md). **Do not read it as pending
> work.**

*Repo hygiene.* **Shipped, having widened enormously on the way.** The four-function env-resolution exception is over:
`resolveNumCtx`, `resolveRatio`, `resolveTimeoutMs` and `loadConfig` each hold their own file, `config.ts`
keeps the `DEFAULT_*` constants and re-exports them, and `ollama-models.ts` is gone — `list-models.ts`,
`has-model.ts` and `pull-model.ts` over a shared `daemon.ts` value module. That is item 1's **first
increment, not its completion**, which is why this line is not struck and the task file is still here.

**What the first increment found.** #94's answer said *"after it, no multi-function files remain in
`src/`"*. That was never true. **96** of the 213 code files under `src/` declare more than one function —
**464** functions between them — and **27** export more than one: `memory-db.ts` 11, `renderer.ts` 10,
`project-git.ts` and `backlog.ts` 8 each. `config.ts` and `ollama-models.ts` were only the two that had
*written the exception down*.

**So item 1 is now the whole sweep, at the wider bar — any *declaration*, not just an exported
function.** Private helpers count, which is what made `config.ts` a violation; so do classes, and so do
inline arrow properties **on a top-level object literal**. At the baseline that is **104 files and 504
declarations**. Three reversals ride
along: types leave their `.type.ts` siblings for the file that owns the function, or the folder's
`types.ts` where no function owns one (**55** siblings to fold in); every pure re-export module is
deleted, **including all 9 directory `index.ts` barrels**, in one final pass once every directory is
swept; and a split file survives only by assembling its parts into an object.

**Governance is settled and wave A is closed.** The amendment landed in `d0176cf` after the user
reviewed it. Wave A then committed four directories in parallel — `core/llm` (`6e1c3f9`),
`core/container` (`b63092e`), `src/context` (`daf08cf`) and `src/commands` (`f08c47c`) — alongside
[2](test-the-invariant-functions.md)'s 195 tests (`973adce`).

**Wave B took `core/ui`, the hub, alone** — `4daa490` for the pure half (8 files, all 11 `.type.ts`
folds, `prompts.ts` deleted) and `1c3b1cb` for the six singletons as assemblers over `<name>-state.ts`
value modules (92 files, **all 179 member call sites byte-identical**, 43 importers changing one import
line each). The directory is at **zero violations**: 122 files holding 103 declarations, counted with a
TypeScript-parser census rather than a regex — and its independent measurement of the 14/77 row in this
table matched exactly. Two agents, two instruments, one number.

| | files | declarations |
|---|---:|---:|
| baseline (regex census, `a0e9e31`) | 104 | 504 |
| cleared by wave A | 13 | 50 |
| cleared by wave B | 14 | 77 |
| cleared by wave C | 29 | 188 |
| cleared by the `interface` agent | 7 | 28 |
| cleared by wave D so far | 9 | 48 |
| cleared by wave D — `interface/commands` | 20 | 103 |
| cleared by wave D — `tools` | 24 | 74 |
| **remaining — measured at HEAD, by parser** | **0** | **0** |

**The last row does not equal the subtraction, and the sweep has not regressed.** The baseline was a
regex pass that declared a pattern for object-literal **method shorthand** and then never added it to the
total; a parser census counts it. `src/tools` — nearly every file of which is
`export const xTool = { …, execute(…) {…} }` — was understated from the start, at 20 / 60 where the truth
is 24 / 74. **Stop decrementing the baseline and measure the tree.** The task file's checkpoint section
carries the parser census, the reconciliation and the one bar question the discrepancy exposed.

**Wave C is CLOSED: `src/core/session` is at zero violations**, down from 28 files / 181 declarations —
the largest directory in the repo — in **14 commits**, `038fc83` through `9c51bfb`. Its first ten:
`038fc83` the git
family (7 files / 39 declarations, five `project-git*` modules and `review-types.ts` deleted, 43 new
files), `eaeb319` the two follow-ups it owed (`hasHead` collapsed to one implementation, `toPosix`
renamed `toPosixTrimmed`), `c69c1b3` the four persistence stores, `61574a9` the backlog reader (18
declarations), `9f4d932` the `types.ts` retrofit (26 declarations into 24 one-type `.type.ts` modules,
plus `task-statuses.ts` and `severities.ts` as plain constant modules, since those are runtime values
rather than types), `45d6313` `memory-db.ts` (26 declarations — the largest single file in the whole
census, and the last "cohesive store module" header in the directory), `463e9ba` `SessionMemory`, and
`c24a371` the debate pair (16 declarations + 8 types, its `isRecord` dedupe importing
`src/core/llm/is-record.ts` directly because the barrel does not export it), and `9fd9e2e` the Retro
runner.

Then the last four: `682e235` the unattended batch driver, `0b65062` the tool dispatcher, `f7bb8d8` the
four two-declaration files, and `ffbc4f0` the Worker and Reviewer runners — which also **retired
`title-case.ts`**, repointing `session-orchestrator.ts` at the shared
[`capitalizePhase`](../src/core/ui/capitalize-phase.ts). `9c51bfb` closed the directory.

**Six differential harnesses re-run after every commit: 2819 probes, 0 mismatches** as of `c24a371`, and
green through the last six.

**The barrel's name set was reported as "held identical at 91 values / 77 types". Re-measured at HEAD,
that is not what happened, and the real invariant is the stronger one.** The set *grew*: 68 values / 55
types at `a0e9e31`, 77 / 55 after `038fc83`, 91 / 62 after `c24a371`, 91 / 71 after `682e235`, and frozen
there for the last three commits. **No exported name was ever removed** — 23 values and 16 types were
added, every one of them a function or type the split gave its own file and the barrel then listed. That
is the invariant worth checking, because removal is what breaks an importer and addition is not. Wave E
deletes the barrel regardless, so the widened surface is transitional.

**Then a later agent measured 92 / 78 and reported the figure above as wrong. Both numbers are right,
and the disagreement is the `export *` blind spot reproducing itself in this very ledger.** 91 / 77
counts the names on explicit `export { … }` lines. The barrel also carries **one** `export *` — for
`config.js` — which forwards exactly `config` and `SessionConfig`, so the *effective* set is 92 / 78.
A line-counting instrument cannot see through a star and a resolving one can. **Quote which question a
name-set figure answers**, because "the barrel's exported names" turns out to be two different numbers.

Closing it unblocked three things at once: the whole `src/tools` wave, the `core/ui/types.ts` retrofit
(which needed `core/session`'s three importers to settle), and the visible-turn agreement test below.

**`src/` root is done** (`66d5a39`): `src/index.ts`'s three declarations are now
`src/boot/{main,resolve-or-exit,fail}.ts`, the entry point declares nothing, three inlined `errMessage`
copies were repointed at the shared one, and **no barrel was minted in `src/boot/`**.

**A third agent has closed all three of its jobs, and all three directories are clean at the bar.**
`src/phases` (`5d74ad4`); `src/core/container` (`2b3e381`) — `types.ts` retired into `tar-entry.type.ts`
plus two folds into `sandbox.ts`, barrel unchanged at 8 values / 7 types; and `src/core/llm`
(`602f62f`) — `types.ts` deleted into four standalone `.type.ts` modules, `ChatResult` folded into
`client.ts`, and the `export type { Message, Tool, ToolCall } from 'ollama'` re-export **deleted** by
the user's ruling, with the five in-folder importers taking them straight from the package; barrel
unchanged at 13 values / 16 types.

**`src/interface` (top level) is COMPLETE** — 7 files, 28 declarations, three commits (`ea9715b`,
`7da4b97`, `26ca3c4`), 32 files at zero violations. `command-registry.ts` took **option (a)**: `commandRegistry` is
a `ReadonlyMap` **value module**, with `get-command.ts` and `list-commands.ts` as separate files rather
than an assembler — and it wrote the TDZ constraint into its header, which is why the constitution now
states that constraint for **any** module-level value read across a cycle rather than for assemblers
alone — and it **survives as a value module**, one exported value, no function, no re-export: the
`daemon.ts` shape, with its header saying so explicitly **so the final barrel pass does not delete it as
a shell.** Its four types were each measured by importer and all four found genuinely unowned. Its
pre-flight census was **exactly right** — 7 files, 28 declarations, per-file 9/5/4/3/3/2/2 — worth
recording after three earlier censuses in this sweep were not.

**[2](test-the-invariant-functions.md) is CLOSED.** Ten original targets plus four `src/context/`
additions — **25 test files, 400 tests, 0 failures, 0 skips**, `tsc --noEmit` clean:

| pass | commit | tests | suite |
|---|---|---:|---:|
| the eight original targets | `973adce` | 195 | 195 |
| `StreamFilter` + `recoverToolCalls` | `d3e0f42` | 136 | 331 |
| `src/context/` | `48af6f5` | 69 | 400 |

**Its actual return was not the tests.** Item 2 was argued on the grounds that the docs were carrying
both specification *and* verification, and it produced **twelve findings across three passes, none fixed
in passing** — four backlog items' worth of places where the docs and the code disagreed:
[22](truncate-to-width-measures-code-units.md), [25](help-command-cannot-be-imported-first.md),
[26](streamed-reply-corruption-in-core-llm.md) and
[27](standards-frontmatter-parsers-disagree.md). The tests are the smaller half of what it delivered.

**One follow-up remains**: the SQL-versus-JS agreement test for the visible-turn predicate. `core/session`
closing removed one of its two blockers; the other is the **runtime** — it is the first test that would
touch `node:sqlite`, which is experimental on 22.x and stable from 24, and the suite has only ever run on
22.14.0 against an `.nvmrc` pinning 24.14.0.

**Six old-style `.type.ts` pairs remain, all in `core/session`** — `events-log`,
`evict-stale-tool-results`, `read-tracker`, `run-stop-signal`, `run-task-loop`, `subagents` — down from
ten as wave C reached their siblings. Each is the sibling of a `.ts` file the sweep has not reached and
**dies with it**, so this is not the retrofit having been left half-done.

There were **fourteen**: eight more sat in `src/tools`, unenumerated by anything until the checkpoint
census found them, and all eight went with that directory's wave in `c88da11` and `abfced0`.

**All six are now gone** (`54eb8b4`, `916a941`, `9cac598`, `aae76ad`), `read-tracker` last and alone as
planned — nine importers, three in `src/tools`. **Zero old-style pairs remain anywhere under `src/`**, and
all **116** surviving `.type.ts` modules were audited to hold exactly one type and no other statement.
Of the 17 types, 9 folded into the function that owns them and 8 became their own modules.

**That wave also settled a rule the tree had been contradicting, and it is the user's ruling.** Folding
by ownership left `TaskLoopDeps` inside `run-task-loop.ts` while its structural twin `BatchDeps` sat in a
standalone `batch-deps.type.ts` — same directory, same rule, opposite shapes. Six such modules exist
(`batch-deps`, `batch-reporter`, `compact-deps`, `dispatch-deps`, `worker-result`, `reviewer-outcome`),
each with exactly **one** non-barrel importer that plainly owns it.

**Ruled: a dependency seam is not owned by the function that consumes it.** A `Deps` or `Reporter`
interface — anything the *caller* implements and passes in — gets its own `.type.ts` even when one
function takes it; a **result** type folds, because one function produces it and nothing else can. The
test is **which side of the call constructs the value**. Note why the rule had to be stated that way:
**counting importers cannot tell the two shapes apart**, since both have exactly one. The clause is in
`constitution.md`. **All three moves have landed** (`df5f891`): `TaskLoopDeps` back out to
`task-loop-deps.type.ts`, `WorkerResult` and `ReviewerOutcome` folded into the functions that build them.

**Each direction was decided by finding where the value is constructed, and the result is the strongest
argument for the rule's wording.** `SessionOrchestrator.runTaskLoop` builds the `TaskLoopDeps` literal
inline and `runTaskLoop` only reads `deps.*` and forwards the object — caller-constructed, a seam.
`WorkerResult` and `ReviewerOutcome` are each returned by exactly one function and by nothing else.

**And the head-count points the wrong way outright.** `TaskLoopDeps` had **zero** non-barrel importers
before the move — nothing named it, because the literal that builds one is contextually typed — while its
sibling *result* type `TaskLoopResult` is named in **eleven** files. **A rule phrased in terms of importer
counts would have folded the seam and split the result**, which is exactly backwards.

Two findings came out of it, filed as [30](dead-exports-and-unused-imports.md): `runWorkerTask` has no
callers at all, and 40 unused imports sit in 20 files behind an absent `noUnusedLocals`.

**Wave D is CLOSED. Both halves are at zero, and with them the whole census.**

**`interface/commands`: 20 files / 103 declarations, nine commits.** Four early (`458c2ab`, `6b5d5d9`,
`a27f9a0`, `5ca1d1f`) created three assemblers on the `models.ts` precedent and **deleted
`project-templates.ts` rather than assembling it** — its one importer took **six named things** from it,
not one thing, the assembler test answering cleanly in the negative. Five more (`0c90c01`, `e2ef474`,
`ed85868`, `49bfd1d`, `56842db`) took the last 11 files / 55 declarations: **63 new single-function
files, seven duplicate helpers retired** (`titleCase` ×2 → `capitalizePhase`, `write` ×2, `messageOf` ×2
→ `errMessage`, `localStamp` → `formatLocalStamp`), and **zero files outside the lane changed** —
`command-registry.ts` needed no edit at all.

**`tools`: 24 files / 74 declarations, thirteen commits** (`00ed603`…`e38e496`), plus `tools/types.ts`
and **all eight** old-style `.type.ts` pairs. Its barrel name set held at 59 values / 13 types, name for
name.

**The bar question `tools` raised is settled**: the user ruled that an `execute(…) {…}` method shorthand
on a top-level object literal **counts**, exactly as an arrow property does — the same declaration
written two ways, and the bar cannot depend on the spelling. That is what makes the directory 24 / 74
rather than 19 / 63.

**A second ruling followed, and it is the more consequential one.** Clearing the census left 23 tool
files each holding one declaration — but that declaration was the tool's whole `execute` body, **16 to
135 lines**, inline in the object literal, while the 17 command files held 1-line members
(`run: swapPhase`). Asked whether the tool bodies should be extracted too, the user ruled **no, and gave
the reason**: *the tool name is the file name; description, parameters and execute all belong in the same
file by the Single Responsibility principle; the object conforms to the Ollama API type; all tools must
be in the same format.* Splitting a tool would divide **one** responsibility rather than separate two.
So `src/tools/<tool>.ts` is the one place in the repo a substantial function body legitimately sits inside
an object literal — and it is a precedent for nothing else, since a command's dispatch and its work
genuinely are two responsibilities. Both clauses are now in `constitution.md`.

Checking that ruling held turned up **the one axis on which the tools are not uniform**: 11 name
themselves with an exported constant and 12 with an inline literal. It is filed as
[28](tool-names-split-between-constants-and-literals.md) rather than fixed in passing — the split
predates the sweep, and it should ship after wave E, which decides where a name constant is imported
from.

**`tools/types.ts` had five outside importers, not the one this file claimed.** `core/session/dispatch.ts`
— the file named as the sole outsider — **no longer exists**; the real five are `dispatch-tool-call.ts`,
`first-missing-required.ts`, `serialize-tool-result.ts`, `tool-call-record.type.ts` and
`tool-result-error.ts`. Total reach was 44 files / 112 named imports, not 50.

**The `core/ui/types.ts` retrofit is DONE (`e92e410`), and with it there is no `types.ts` anywhere under
`src/`** — the per-folder convention is fully reversed. Five types, 16 importers, 22 files in one commit,
and every home decided by measuring importers: `ToolCallDisplay` (8), `MarkdownStream` (4, two of which
*return* one), `KeypressListener` (3), `KeypressSource` (2, both of which *take* one), `ToolDiffDisplay`
(1, which returns it). All five became `.type.ts` modules rather than folding into a function's file.

**`ToolDiffDisplay` is the one that looks like it should have folded and did not**, and the reasoning is
worth keeping: `buildFileDiff` returns it and is its only importer — exactly the shape that folded
`ChatResult` into `client.ts`. It stayed out because `4daa490` had already measured this group and found
no owning function, and because folding it would make `core/ui` import a type out of `src/tools`,
inverting the only edge that exists between them. Reversal is one file and two import lines if that reads
wrong later.

**`16caa82` swept three leftovers the retrofit surfaced but could not reach.** `confirm-key.ts` held a
**fourth** byte-identical `KeypressListener`; it never appeared in the 16 importers because a file that
declares its own copy is not an importer — which is a measurement blind spot worth remembering, not just
a missed file. Fixing it also repaired the new module's header, which claimed the type was *"declared by
none of them"*. And `safe-id-path.ts` and `task-branch-name.ts` both pointed at a `types.ts` deleted back
in `9f4d932`; the example they cite now lives in `task.type.ts`.

**Wave E is COMPLETE, and the "nine barrels, one atomic pass" shape did not survive measurement.**
There are ten `index.ts` files; **eight** are pure re-export barrels, **`src/core/index.ts` is not one**
(zero re-exports — four lines of comment held in the graph by `export {}`), and **`src/index.ts` is the
entry point and survives** — which matters because `find src -name index.ts` returns it.

**`config.ts` owed one last thing and `483237f` paid it** — the sweep's oldest debt. It now holds zero
declarations and exports **exactly one value**, `config`, carrying the six constants *and* `loadConfig`
*and* the three resolvers as properties, with `export type { SessionConfig }` riding along. The ESM cycle
survives, re-driven across five entry orders in one process each.

**That job also exposed a gap in how every coupling figure in this sweep was measured**, and it is the
most important thing to carry forward. It was briefed with **six** importers — every file naming
`'./config.js'` directly, correctly counted. The truth was **eight**: `core/session/index.ts:2` was
`export * from './config.js'`, so `boot/resolve-or-exit.ts` and `interface/run-repl.ts` took config's
names *through the barrel* and were invisible to a direct-import census. **`run-repl.ts` could not have
been left alone by any arrangement**, since `SUGGESTED_MODEL` has no standalone export once the constants
live inside the object. The parcel guarantees in the brief are stated as *zero file overlap* and were all
computed the undercounting way; the overlap was genuinely zero here, but because the agent checked, not
because the method was sound. **Resolve `export *` transitively before trusting an overlap of zero** —
which matters most for the barrel pass, since it is entirely about star re-exports.

**`93dc209` deleted the first two**, the ones the measurement showed were free: `core/ui/index.ts`, which
had **zero** importers because wave B had already repointed all 43, and `interface/index.ts`, which had
exactly one — a single line in `src/boot/main.ts`. Its agent reproduced all ten importer counts exactly
and proved its instrument by making it report 65 real importers of `core/llm/index.ts` and then go red on
14 spelling probes after the deletion.

**The last six went in six commits** (`e93e869`…`b130a91`), smallest blast radius first so the instruments
were proven before the hard ones: `tools` (5 importers), `phases` (7), `context` (12), `core/container`
(13), `core/llm` (66), `core/session` (54). **127 distinct files, 306 named imports repointed**, every one
proven by the checker's aliased symbol to land on the module that declares it — **306/306, with 306
wrong-home controls fired**. All 178 import declarations used the explicit `.../index.js` form: no folder
imports, no side-effect-only imports, no dynamic `import()`, and no importer under `__tests__`.

**Three of my figures were wrong and the agent caught all three.** `core/llm` carried **29** names from
**18** homes with **66** importers, not 26/17/65 — my count had excluded `Message`, `Tool` and `ToolCall`,
which the barrel re-exported **from the `ollama` package** rather than from a file. Total named imports
was **306**, not 311. And my summary line said 65 importers while my own per-directory breakdown added to
66 — **the detail was right and the total was wrong**, which is the more useful catch.

**The `export *` warning was true when written and had expired.** The one star forwarded `config` and
`SessionConfig`, and by the time wave E ran, both of the files that used to take them through the barrel
imported `config.js` directly. Chased and empty — which is the right outcome for a warning, not a reason
to have skipped it.

Three files must not be deleted by it, distinguished by *one exported value, no function, zero re-export
lines*: `src/index.ts`, `src/interface/command-registry.ts` and `src/core/llm/daemon.ts`. And one more
trap, found by the agent that did the deletions: **`find src -name index.ts` is safe but a suffix pattern
is not** — `src/core/session/tool-call-args-by-index.ts` matches `*index.ts`, so a mechanical wave-E
command written that way sweeps up a real function file.

**`src/core/index.ts` is gone (`530f273`), and it needed a ruling first.** The user ruled the comment goes into
[docs/repo-layout.md](../docs/repo-layout.md) and the file is deleted; in the event only its framing
phrase was not already there in richer form, and one line of it — attributing the *phase factory* to
`session/` — was simply **stale**, since the factory is `src/phases/factory.ts`.

Its `(task 03)` reference blocked the deletion until it was chased down, and **the answer is worth
keeping because it applies to ten other sites.** The Foundation tasks were real task files completed at
an older date: `tasks/foundation/03-ollama-client.md`, marked *Completed 2026-06-30*, shipped in
`796454c`, one of 24 indexed by a `ROADMAP.md` that **`be503a1` deleted along with the whole `tasks/`
tree** — this repo's own convention, *one file per task, deleted in the commit that ships the work*. So
the numbering is a pointer into git history rather than a dangling reference, it still resolves
(`git log --grep="Foundation 03"`, `git show be503a1^:tasks/foundation/03-ollama-client.md`), and in this
case the comment's own prose already said what the task file said. **Eleven source files still carry such
numbers; none is lost, and none needs an index written for it.**

The user also set the general policy for barrel prose: **relocate anything unpreserved onto the owning
file's header and report it in the commit message** — do not ask, and do not silently drop it.

Re-measure the coupling before starting any of them — the graph has changed under every wave so far,
and this shape is a starting point rather than a schedule. Measured after wave D closed, the remaining
parcels are **almost entirely serial**: everything funnels through `core/session` importers, and the only
pair with zero overlap is `core/ui/types.ts` alongside `config.ts`'s reshape.

The baseline was **106 / 528** until wave B found that an arrow property only counts when its object
literal is at module top level. Twenty-two arrows across ten files sit inside a function body instead —
`renderer.ts` alone accounted for three — and two files left the violation list outright.

A further round of governance clauses — classes, inline arrows, the barrel wording, the type-export
carve-out and the *Testing* rewrite — is drafted and waiting on the user. The task file carries the
census, the barrel table, the import-graph analysis, the partition and the open follow-ups.

**Why first:** unchanged in substance and now much stronger. Stated in its own file and in
[item 12](budget-ceilings-for-runs-and-batches.md): ship it **before** the budget ceilings, so the new
resolver is written into the shape that already exists rather than added to an exception and moved
afterwards — that half is done, and item 12's bullet now says so. The same argument reaches
[item 6](boot-can-pick-a-toolless-model.md) through the second file: that item rewrites `listModels` to
stop projecting `capabilities` away, and it now lands in `list-models.ts`. At the widened scope it also
blocks [2](test-the-invariant-functions.md), [5](record-attempted-tasks.md) and
[7](derive-constants-from-one-ceiling.md), each of which tests, moves or adds to a function the sweep
will relocate.

### 2. ⚠ Ask first — [Test the pure invariant functions](test-the-invariant-functions.md)
*Engineering quality.* The invariants the whole design rests on, pinned by tests: `verdictGitConflict`,
`resolveInProject`, `replaceStatus`, `nextRunnableTasks` / `taskSkipReason`, the `readTaskFile` field
readers, `StreamFilter` and `recoverToolCalls`, `taskBranchName`, `addTokenCounts`, and the width layer.
No Docker, no Ollama, no real terminal — everything else stays on the throwaway-script and
terminal-emulator rules.

**The question, asked before any code is written.** `constitution.md`'s *Testing* section exempts the
orchestrator outright, so this contradicts it as written. Ask whether to amend that section, and if so
whether the scope is "pure functions only" or something broader. **Do not amend the constitution as part
of the task** — that edit is governance and review-gated, and the answer may be no, in which case the
file is deleted.

**Why here:** after [1](split-config-into-one-function-per-file.md), so the tests are written against the
settled module layout rather than moved with it — and before everything else, because everything else
changes a function on that list. [Item 5](record-attempted-tasks.md) puts a fifth member through
`replaceStatus` and adds a fourth committer beside `verdictGitConflict`;
[item 12](budget-ceilings-for-runs-and-batches.md) adds a sixth outcome next to it; and
[item 11](in-turn-progress-reporting.md) adds fields to the rows the width layer paints. Pinning them
first is what makes those three safe to change.

### 3. ~~The required Node version is never enforced~~ — shipped
*Repo hygiene.* **Shipped.** `.nvmrc` is the single source of truth and now the **only** declaration:
`package.json`'s `engines` is deleted (#80a), `docker-compose.yml` interpolates the pin through a
`NODE_VERSION` the launcher exports (#76a), and `scripts/run.mjs` reads `.nvmrc` at the front of the
process and refuses **both** `start` and `install` (#73). The comparison is the **major**, so any
Node 24 passes and v22.14.0 — this box — does not. `stop` is never gated. A `.nvmrc` that is missing
or malformed refuses those same two verbs: with the only declaration unreadable there is nothing to
check against, and a check that cannot run must not report a pass. Four declarations, none enforced,
are one declaration enforced in three places.

**The original premise was wrong, and the file said so before it was deleted:** `node:sqlite` **does**
work on the v22.14.0 this box runs, so there was never a `memory.db` failure to confirm. The floor
stays at 24 because a version declared in four places and enforced in none tells you nothing about
what the code was tested on. Two accepted costs are on record: `docker compose` run by hand, without
the launcher, no longer resolves to the pinned image, and `README.md`'s "Node 24 LTS" is now the last
stale copy — [README-INCONSISTENCIES.md](../README-INCONSISTENCIES.md) #15 and #11. The
`docs/cli.md` diff is review-gated and was left uncommitted.

### 4. ~~`/resume` hides contexts written under a different ceiling~~ — shipped
*Memory / context.* **Shipped.** `listContexts` and `resolveContextId` filter on `num_ctx <= ?`, so a
context written under a **smaller** ceiling is listed and reopenable again while one written under a
**larger** one stays hidden. The asymmetry is the fix: a history built for 8 192 replays safely into
16 384; the reverse silently loses its front. Only the **read** predicate moved — the stamp is still the
exact raw `OLLAMA_NUM_CTX`, and `memory.ts` still imports no resolver.

**Both presentation decisions were answered, and both were taken.** The warning **names the old ceiling
and the current one** — `⚠ Written under OLLAMA_NUM_CTX 8,192; this session runs at 16,384.` — accepting
the risk that it reads as an invitation to set the env var back. And the **listing marks** every
mismatched context (`⚠ num_ctx 8,192` on the row, with a legend below it) **as well as** the restore
warning: the listing is where the choice is made, so the mismatch has to be visible before it, and the
warning fires on top. To make the second half reach `/resume <address>`, which never sees a listing,
`reopenActiveContext` now returns the reopened `ContextSummary` instead of a bare boolean.
`docs/mental-model.md` and `docs/cli.md` were corrected in the same change (review-gated).

### 5. [Stop a failed task looking untouched](record-attempted-tasks.md)
*Execution loop.* A fifth `TaskStatus` (`failed`), written after the stash and committed by the loop via
`commitPaths`, so no dirty-tree gate has to learn an exception. `/run all` skips it; `/run <id>` retries
from scratch. Its `docs/phases.md` "Who may commit" edit is review-gated.

**Why here:** independent of items 1–4, and it ships the first half of a shared vocabulary. Stated in
both files: this and [item 12](budget-ceilings-for-runs-and-batches.md) *"ship the same vocabulary for
'ended without a verdict'"* — `failed` in `TaskStatus`, `over_budget` in the batch outcomes. Building
this one first means `failed` exists before `over_budget` has to sit beside it.

### 6. [Boot can pick a model that cannot call tools](boot-can-pick-a-toolless-model.md)
*Model behavior.* `pickSmallestModel` is **deleted**, not filtered: a saved `activeModel` wins, otherwise
the user chooses from a list where toolless models are shown, marked and never selectable. Plus the boot
VRAM probe behind the *too heavy* tag, its own accumulating cache file keyed on `digest` (#103), and the
Ollama ≥ 0.9.1 floor stated and checked.

**Why here:** after [1](split-config-into-one-function-per-file.md) (the capability read lands in the
split `ollama-models.ts`) and after **item 3**, now shipped (its version check is the Node
check's sibling). The largest of the defects, and the one that gates first-run usability — on this box
three of nine models have no `tools` and six cannot keep their weights resident, leaving exactly one that
can run the product.

### 7. [Derive every budget from one ceiling, in exact tokens](derive-constants-from-one-ceiling.md)
*Memory / context.* The local BPE tokenizer built from `/api/show` `verbose: true` — exact against
Ollama's own `prompt_eval_count`, ~2 ms per 12 000 characters — then the fraction table: six model-facing
budgets become exact token counts derived from the one `.env` ceiling, `BOUNDED_ONE_SHOT_NUM_CTX` becomes
`base / 2`, and two human-facing caps stay in characters.

**Why here:** stated — *"the tokenizer is the first half and nothing else can precede it."* Six budgets
across five files take their unit from it, and [item 8](cap-the-debate-background-parameter.md) and
[item 12](budget-ceilings-for-runs-and-batches.md) are both waiting on that unit. This is the first point
in the sequence where a model-facing number changes meaning, so everything downstream is written in exact
tokens once. Its new resolver wants [item 1](split-config-into-one-function-per-file.md)'s shape for the
same reason item 12 does.

### 8. [Cap `debate`'s `background` parameter](cap-the-debate-background-parameter.md)
*Memory / context.* The one model-supplied payload in the repo with no bound, replayed into two windows on
every call — up to ten times in one debate. Truncated head+tail at the entry gate in `debate.ts`, recorded
on the existing `debate` events row, and taught to the parameter description and the five phase files.

**Why here:** stated in both files — *"ship this task after the tokenizer, or the cap is written twice"*,
once in characters and once in tokens. Its 12 000-character cap is a row in item 7's fraction table
(`base × 3/16`). It is also the prerequisite for letting `debate-turn` and `debate-digest` take a reduced
ceiling in `resolve-window-ctx.ts`, where they are pinned to the base for exactly this reason.

### 9. [The spawned windows have no failsafe, and no record](spawned-windows-have-no-failsafe.md)
*Memory / context.* All **six** spawned windows get compaction — Worker, Reviewer, Retro, sub-agent and
both debate windows — summarizing at the existing 0.75 ratio with `[0]` and `[1]` protected, because `[1]`
is the window's seed. **And the second half:** every spawned window persists its whole trace into
`contexts` + `messages` under a namespaced `worker:spawned`, which `/resume`'s existing filter excludes by
construction.

**Why here:** after [8](cap-the-debate-background-parameter.md) by the files' own pairing — a cap bounds
what `background` contributes at index 1, and only a failsafe bounds five rounds of argument growing on
top of it. The widest single item still open, and the one that ends the current situation where an
unattended overnight batch destroys every window it opens. Price the volume before building: hundreds of
`messages` rows per task.

### 10. [Make the standards visible](surface-matching-standards.md)
*Model behavior.* All nine standard names resident at `ctx[0]` in every phase (~50 exact tokens, 0.3 % of
the window), a new `describe_rule` returning a one-line description so the model can judge a standard
before paying for its body, the seed-time match kept as an always-top-1 hint, and
`simplified-technical-english` demoted from an unconditional load to a conditional one (#89).

**Why here:** judgement, not a stated constraint — it depends on nothing in 1–9. It is placed after
[7](derive-constants-from-one-ceiling.md) because it puts a permanent resident cost into every window, and
that cost is easier to justify once every budget it competes with is exact rather than estimated. Its
sharp end is #54c: telling the Reviewer a hinted rule was **not loaded** needs tracking that does not
exist, and it is a way to fail a task on a technicality — write that prompt carefully.

### 11. [Show where a long task has got to](in-turn-progress-reporting.md)
*Terminal UX.* Both halves: the pinned rows (`Phase: Design → Worker T-042` appended not substituted,
`Ctx: N%` following the live window and reading an exact `0%` before its first response) **and** the
scrollback, which must print what a `/run` is doing as it happens — one interleaved stream coloured per
phase, a transition line on every swap, a closing line per round. `/batch` is removed; `/audit` stays.

**Why here:** four later items consume it, and it costs zero model tokens — every field is already known
to the orchestrator. It owns the `Ctx` field that [item 12](budget-ceilings-for-runs-and-batches.md)
consumes (#46, #64), supplies the live-window label that makes [item 13](steer-a-running-turn.md)
legible (#91a), gives [item 15](background-long-running-commands.md) somewhere to report progress, and
removes one of [item 20](task-plan-inside-a-task.md)'s two justifications. The layout and drop order are
delegated to build time — **do not stop to ask.**

### 12. [Budget ceilings for a window and a batch](budget-ceilings-for-runs-and-batches.md)
*Execution loop.* A per-**window** wall-clock ceiling on **model time**, reset on every phase swap
(#87, #95b) — the wedged-call detector. Crossing it produces a fifth outcome, `over_budget`; the task's
dependents stop with it and every independent task still runs, which the batch's per-iteration
`unmet-deps` reload gives almost for free. `.env` only, unset means unlimited, fail open loudly.

**Why here:** three constraints converge on this position. After
[1](split-config-into-one-function-per-file.md) (stated), after
[7](derive-constants-from-one-ceiling.md) (stated: it *"sets the precedent for where a derived constant
lives"*), and after [11](in-turn-progress-reporting.md), which owns the live display this consumes. Read
it together with [5](record-attempted-tasks.md). Re-read #86 before building: #38's stated reason for
wall-clock-only does not hold, but the decision stands on a better one.

### 13. [Steer a running turn](steer-a-running-turn.md)
*Terminal UX.* Inject a message at the next tool-call boundary in `turn-loop.ts` rather than queuing it
until the turn ends.

**Why here:** stated (#91a). It builds **after** [11](in-turn-progress-reporting.md), because
*"knowing which window is live is the difference between correcting the Worker and interrupting the
Reviewer."* Its other prerequisite — cancelling a turn — has shipped, which is what made this optional
rather than the only way out of a bad turn. Three open decisions remain in the file, including whether
steering is available during a batch at all.

### 14. [Give the model a `switch_phase` tool](switch-phase-tool.md)
*Model behavior.* The first of the guardrailed tools that stand in for a slash-command the model must
never be handed. It starts the target phase with its base context, a starter message written by the
calling phase, and either a fresh or an existing phase context — and the started phase runs immediately.

**Why here:** judgement, not a stated constraint. Its prerequisite landed in `3cc8b7b`, so it could be
built at any point after that. It goes after [11](in-turn-progress-reporting.md) and
[12](budget-ceilings-for-runs-and-batches.md) because a phase swap now prints a transition line (#65) and
resets the window clock (#95b) — a tool that multiplies swaps is better built once both are swap-aware.
**Read the implementation hazard before starting:** the switch must not split a `tool_calls` / `tool`
pair across two histories.

### 15. ⚠ Ask first — [Background long-running commands](background-long-running-commands.md)
*Execution loop.* A start call that returns a handle immediately and a poll call that returns status plus
whatever output has accumulated, the same head+tail truncation the blocking path already applies, and a
hard reap at the end of the task so a backgrounded process never outlives the window that started it.

**The question, asked before any code is written.** Does the **no parallelism** non-goal in
`docs/product.md` cover a shell command running in a container while one window thinks, or only
concurrent model windows? The stated reasoning is about VRAM and concurrent model windows, which does not
obviously reach a container running `npm install` — but it may be intended to, and that is not something
to assume. If it covers both, **delete the file and record the reasoning in `docs/product.md`** so the
question does not get re-opened. Nothing in the file is worth designing until this is settled.

**Why here:** its reaping rule — *"a Reviewer must not inherit a running container from the Worker"* — is
a phase-lifecycle rule, and by this point [12](budget-ceilings-for-runs-and-batches.md) resets a clock on
every swap and [14](switch-phase-tool.md) can cause one, so lifecycle is already something the code
reasons about explicitly. [Item 11](in-turn-progress-reporting.md)'s scrollback is also what gives a
backgrounded command anywhere to report progress. Three further decisions stay open in the file,
including whether a turn may end with a command still running.

### 16. [Add a glob-by-path tool](glob-files-by-path.md)
*Harness capability.* Paths are the cheapest unit of knowledge about a codebase — the tool that lets a
phase orient itself for tens of tokens instead of thousands. Sort by mtime, return paths and nothing else.

**Why here:** first of the four that have no dependency on anything above, ordered among themselves by
cost. Three decisions are **still open in the file** and are the user's, not an implementer's: new tool
or a mode of `list_files`, which glob syntax and implemented by what, and the result cap. Settle them
before writing code — the syntax choice constrains what the phase prompts can teach.

### 17. [Smooth the new-project path](smooth-new-project-onboarding.md)
*Onboarding.* Scaffold → exit → restart → commit by hand → plan. The scaffold-commit fix is the small half
and removes the dirty-tree refusal for the common case; the restart is the large half.

**Why here:** independent, and cheap in its small half. **Two open decisions in the file**, both the
user's: whether `/new-project` committing its own scaffold conflicts with git staying model-driven, and
whether project switching is worth having at all given `docs/phases.md` locks a session to one project on
purpose.

### 18. [Structured sub-agent results](structured-subagent-results.md)
*Harness capability.* A required response shape declared at spawn, generalizing what `submit_verdict` and
`debate` already do. The isolation exists; the bound does not.

**Why here:** independent. **Three open decisions in the file**, including who declares the shape — the
caller or the tool — which is the one that decides whether schema authorship ends up in a small model's
hands.

### 19. [Move both logs into SQLite tables](move-the-logs-into-sqlite-tables.md)
*Memory / context.* Nothing reads `events.jsonl` — five event types written to a file no command
surfaces, so an unexplained pause has no in-app explanation. Both logs become **two tables** in the
existing `memory.db`: the concerns stay distinct in the schema, and what unifies is the store and the
reader.

**Why here:** after [9](spawned-windows-have-no-failsafe.md), which is what makes `memory.db` the store
for everything a window said; the two grow side by side and item 9's file names the overlap. It also
inherits [item 11](in-turn-progress-reporting.md)'s residue — `runBatch` keeps writing
`.orchestrator/batches/` with no command to print it, which is an argument for folding those summaries in
here. **Five open decisions in the file**, and it overturns a stated invariant in `events-log.ts`'s
header and trades away `audit.ts`'s durability argument — read both headers first.

### 20. [A plan inside a task](task-plan-inside-a-task.md)
*Execution loop.* A small `task_plan` the Worker writes once and then **replaces**, placed late in the
history so the rewrite stays cheap.

**Why last:** stated — *"Build the reporting half first; it is free. Then decide on this one with
evidence."* [Item 11](in-turn-progress-reporting.md) removes one of its two justifications, leaving the
decision to rest on whether it helps the **model**, which needs a measurement that does not exist yet.
The lowest-confidence item in the folder, and the one most likely to end in a deletion rather than a
build. Measure rounds-to-pass with and without, on the same tasks, before keeping it.

### 21. [The Node version is still hardcoded in the sandbox and the runner](node-version-hardcoded-in-the-images.md)
*Repo hygiene.* [3](node-version-is-not-enforced.md) closed on *"four declarations, none enforced, become
one declaration enforced in three places."* The arithmetic was wrong: **three more survive**, all spelling
the tag by hand — `sandbox.ts:35`'s `DEFAULT_IMAGE`, `project-templates.ts:43`'s runner scaffold, and
`projects/hello-world/docker-compose.yml:3` — plus four comments naming the tag descriptively.

**It is not one cleanup, and that is the whole point of the file.** Under the two-tier Docker model,
`sandbox.ts`'s `DEFAULT_IMAGE` is plainly the same declaration item 3 was consolidating — the root sandbox
is the orchestrator's own tool-execution container, and *the Node a project is built against is the Node
the orchestrator runs on* applies to it verbatim. **The per-project `runner` is a different container**,
and whether a project the model is building inherits the orchestrator's pin is the user's decision, not an
oversight to sweep up. Two of the four comments reason about the image being Debian-based rather than about
its version, and may be right as they stand. Ask; do not assume the second follows from the first.

**The general form, because this is the second time the same arithmetic has come up short.** Item 3
closed on *"one declaration, enforced in three places."* It was true of every chokepoint that existed —
and then `npm test` was added to `package.json` by a different agent, invoking `node` **directly** rather
than through `scripts/run.mjs`, so the pin is unenforced there. **A rule enforced at every chokepoint
that exists does not cover the next chokepoint someone builds**, which is a sharper failure than a missed
case. So: **an enforcement count is a claim about today's surface, and a doc that states one should say
so.**

**Why last, and why it is not urgent:** nothing depends on it, and the defect is **latent rather than
live** — `.nvmrc` is `24.14.0` and every hardcoded tag is `node:24-slim`, so the majors agree today and
only drift when the pin's major moves. It is filed rather than folded into
[1](split-config-into-one-function-per-file.md) deliberately: that sweep rewrites `sandbox.ts`, and burying
a behaviour change inside a no-behaviour-change refactor is how a defect stops being reviewable. **Item 1
carries `DEFAULT_IMAGE` across unchanged and reports where it lands.**

### 22. [`truncateToWidth` measures code units, not columns](truncate-to-width-measures-code-units.md)
*Terminal UX.* `src/core/ui/truncate-to-width.ts` promises columns in its header and counts UTF-16 code
units in its body — the **only** member of the width layer that never calls `visibleWidth`.
`truncateToWidth('日本語', 3)` returns the string unchanged at **6** columns wide; `('😀ab', 2)` returns a
lone high surrogate.

**Why it is not a formatting nit.** Its sole caller, `render-question-panel.ts`, redraws by moving the
cursor up by its own line count, so it needs exactly one terminal row per logical line. An over-wide line
wraps, the panel's idea of its own height is short by one, and the redraw smears the panel down the
screen on every repaint — **the exact failure the function exists to prevent**, reachable in normal use
by any question panel quoting a non-Latin path, title or model sentence. The fix is to iterate by code
point through `codePointWidth`, the tested machinery it already declines to call.

### 23. [`taskBranchName` produces refs git rejects, and silently drops titles](task-branch-name-produces-invalid-refs.md)
*Execution loop.* Its comment claims it strips what *"git could choke on … rather than discover it at
checkout time"*. Discovery happens at checkout time. An interior `..` survives `safeIdPath`, so
`id: 'a..b'` yields `task/a..b-go`, which `git check-ref-format` **rejects** — verified against the real
tool, not inferred from the rules. The branch cannot be created, so the task cannot start.

Second defect: the leaf check is a plain `endsWith` rather than a segment match, so `id: '01-latest'`
with title `'Test'` produces `task/01-latest` and **drops the title silently**. That is *literally*
consistent with the header, which describes a suffix match — which is why it is filed rather than simply
fixed. Fix the code and the comment together, or the next reader re-derives the ambiguity.

### 24. [Three drifts between `backlog.ts` and its own documentation](backlog-reader-drifts-from-its-own-docs.md)
*Execution loop.* The file the scheduler reads the world through disagrees with its own comments in three
places. They share a file, a reviewer and a test suite — **not a cause**.

**The first may be a documentation defect rather than a behaviour one, and that is the point of filing
it.** `nextRunnableTasks`'s JSDoc says both `/run` paths *"skip identically"*; they diverge on
`in_progress`, which the batch driver filters out and `taskSkipReason` calls runnable. So `/run <id>`
starts a task the batch driver would never pick — which is probably the *useful* behaviour, and is how
[5](record-attempted-tasks.md) already rules a named id should differ from a bare selector. One of the
two is wrong and nobody has said which. **Do not answer it by making them agree.** The others: a
`readme.md` becomes a phantom task, because the extension test is case-insensitive and the level-doc test
is not — a Windows and macOS defect against the OS-agnostic reach `docs/product.md` commits to; and
`replaceStatus` normalises a whole mixed-ending file despite promising to preserve the rest verbatim,
which matters once [5](record-attempted-tasks.md) has the loop committing that file.

---

**Items 22, 23 and 24 were all found by [2](test-the-invariant-functions.md)** while pinning the
invariant functions, and they share two properties that make them safe to pick up later.

- **The tests already assert the current, wrong behaviour**, deliberately and with a comment saying so.
  Fixing any of these means changing its test — that is the mechanism working, not a surprise. Item 2 was
  told to pin what the code does, flag the discrepancy, and neither fix it nor promote a bug to a
  requirement.
- **None of them may ride along in a sweep commit.** A behaviour change inside a mechanical refactor is a
  change nobody reviews. [22](truncate-to-width-measures-code-units.md) is the sharpest case: `core/ui` is
  the next wave and will be moving the very file that needs fixing. Land the sweep, then the fix, against
  the settled file.

### 25. [`help.ts` cannot be the first module imported](help-command-cannot-be-imported-first.md)
*Engineering quality.* Entering the module graph at `src/interface/commands/help.ts` throws
`ReferenceError: Cannot access 'helpCommand' before initialization` — a temporal dead zone across a
cycle, since `help.ts` needs the command list and the command list contains `helpCommand`. **Latent, not
a regression**: it fails identically before the sweep, and the nine other entry points probed are fine,
including every path the app actually takes.

**It is a task rather than a note because it blocks test coverage.** `constitution.md` requires a test to
import the file owning the function under test, so a test for `helpCommand` enters the graph at exactly
this module and throws before its first assertion. That makes it a **prerequisite for
[2](test-the-invariant-functions.md)'s follow-up work**, and the first test written for that directory is
what turns latent into blocking. The method is worth keeping too: **one process per entry point**, since
Node's module cache makes first-import order the only variable and a second import in the same process is
served from cache.

### 26. [Two ways `core/llm` corrupts the reply the user reads](streamed-reply-corruption-in-core-llm.md)
*Terminal UX.* Two defects from [2](test-the-invariant-functions.md)'s `core/llm` pass, grouped as
[24](backlog-reader-drifts-from-its-own-docs.md) was — one directory, one reviewer, one symptom class:
**the model's output is correct and what reaches the screen is not.**

**A reply ending in a fenced code block loses its closing fence.** `flush()` returns held text only in
`prose` and `fence_close`, and a closing ``` sits in `fence_open`. **It is lossless only when prose
*follows* the block** — the closing fence is then re-read as a new opener and aborted back into prose —
so **the ordinary case fails and the unusual one passes**, which is the distribution that keeps a defect
alive. `system-prompt.ts` instructs the model to fence its code, so a reply ending with the code it just
wrote shows an unterminated block. A trailing single backtick goes the same way.

**`repairDecode` counts `consumed` in code points while every caller slices in code units**, so each
astral character undercounts by one and the tool-call span misaligns. The call is recovered correctly —
the **debris** lands in the reply: `'a {"name":…"hi 😀"}} b'` cleans to `'a } b'`. One emoji is enough.
Its JSDoc says `consumed` *"counts characters"*, which is exactly ambiguous enough to read as correct.

Both carry the standing conditions: **the tests assert the current behaviour**, so a fix changes its
test, and **neither may ride in a sweep commit** — easy here, since `core/llm` closed at `602f62f` and
there is no refactor in flight to hide behind. The file also records one **non**-defect, so nobody
promotes it: `expandOverFence`'s unreachable guard.

### 27. [Three defects in the standards frontmatter parsers](standards-frontmatter-parsers-disagree.md)
*Engineering quality.* From [2](test-the-invariant-functions.md)'s `src/context/` pass, in the pair that
decides which standards the model can find and what it reads.

**A UTF-8 BOM defeats both parsers, and one aborts boot.** Both anchor `^---` with no BOM tolerance, so
one standards file saved BOM-first — routine for a Windows editor, on a Windows box — throws
`Missing YAML frontmatter (leading --- block)` **naming that file**, while the file visibly has one. It
ranks near [22](truncate-to-width-measures-code-units.md) for the same reason: **the defect is the
misleading diagnosis**, which sends the reader to inspect the one thing already correct. The
`splitFrontmatter` half is quieter and worse — empty name, so the standard is simply unreachable, with
the raw `---` block handed to the model as body. **The repo already disagrees with itself**:
`split-task-frontmatter.ts` tolerates a BOM on purpose. Latent — none of the nine standards files has one.

**`splitFrontmatter` strips CRLF blank lines only partly** — `/^
?
+/` is one optional `
` then a run
of `
`, so an LF file loses every leading blank line and a CRLF file loses exactly one. All nine
standards files are CRLF. **First reported as live and corrected to latent by driving the real tree**,
which is worth as much as the defect: it is one formatting edit from biting.

**The two parsers disagree about a duplicated key** — last-wins vs first-wins — so a file repeating `name`
is catalogued under one and resolved under another: listed by `search_rules`, unreachable by `load_rule`.

Standing conditions as ever, with no excuse available: **`src/context/` closed at `daf08cf`.**

### 28. [Half the tools name themselves with a constant, half with a literal](tool-names-split-between-constants-and-literals.md)
*Repo hygiene.* From [1](split-config-into-one-function-per-file.md)'s `src/tools` wave, while checking
that the user's tool-shape ruling actually held. All 23 tools do share one shape —
`{ name, description, parameters, execute(…) {…} }`, verified by parser — and **`name` is the single axis
on which they disagree**: 11 spell it with an exported constant, 12 with an inline literal.

**The split is not a typo, which is what makes it a question.** The eleven constants exist because
something outside the tool needed the name as a symbol, and all eleven are used —
`worker-window.ts:47` keys a record on `[COMMIT_CHANGES]`, `reviewer-window.ts:188` compares
`name === COMMIT_CHANGES`, `build-reviewer-seed.ts:43` interpolates two of them into a prompt the model
reads, and `subagents.ts:37` builds `SUBAGENT_TOOL_NAMES` from three. The twelve literals are the tools
nobody has yet needed to name from outside. Today's state is what you get from adding a constant the
first time each name is needed, and never going back.

**The repo also has two competing conventions for naming a tool from outside, and one of them is
unguarded.** `phases/phase-tool-names.ts` spells every name as a literal and can afford to, because
`resolve-phase-tools.ts` **fails loud on a name no tool answers to**. The `core/session` comparison sites
have no such guarantee: a typo in `name === COMMIT_CHANGES` is a compile error, a typo in
`name === 'commit_chnages'` simply never matches — and **a tool that silently never matches is invisible
at runtime.** That asymmetry is the real argument, and it points at the constant.

**Ships after wave E**, which decides where a tool-name constant is imported from —
`src/tools/index.ts` re-exports five of them today and is being deleted. Filed rather than folded into
item 1 for the usual reason: adding twelve exported constants inside a no-behaviour-change refactor
buries an API change in a mechanical diff. **The sweep made this visible; it did not cause it** — the
11/12 split predates it, in the same files, for the same consumers.

### 29. [Fourteen comments still name files the sweep deleted](prose-names-files-the-sweep-deleted.md)
*Repo hygiene.* Residue of [1](split-config-into-one-function-per-file.md), and **by design rather than
neglect**: every wave fixed only the stale prose its own change caused, because editing a comment in a
directory the wave did not own is exactly the contention the per-directory partition existed to prevent.

Fourteen sites point at four files that no longer exist — `turn-loop.ts`, `worker-runner.ts`,
`reviewer-runner.ts`, `retro-runner.ts` — plus `OPEN-QUESTIONS.md:957`, which names the retired
`events-log.type.ts` in the present tense. **Nothing will ever surface these**: no compiler error, no
failing test, no lint. A reader follows the pointer, finds nothing, and reconstructs which file inherited
the behaviour.

**It is an editing job, not a find-and-replace.** Six of the fourteen sit in `src/tools` and `src/phases`
describing a *policy boundary* — *"worker-runner refuses this tool; reviewer-runner allows it"* — and the
successor is not one file: the Worker's refusal now lives in `worker-window.ts`'s `WORKER_REFUSALS` while
the phase gate lives in `phase-tool-names.ts`. Repointing those at a single file would be **less** accurate
than leaving them, so the open question is whether they name the concept instead and stop being fragile
against the next rename.

**Ships after wave E**, which deletes one of the fourteen sites outright (`tools/index.ts:34`) and may move
others. Worth knowing where it sits on severity: this sweep has already turned up **four headers that
asserted something outright false**, each caught only because someone read the code beside the comment. A
pointer to a deleted file is the same class of defect — prose a reader is entitled to trust and cannot —
at a lower grade.

### 30. [Dead exports and unused imports, neither of which the build can see](dead-exports-and-unused-imports.md)
*Repo hygiene.* Two findings from [1](split-config-into-one-function-per-file.md) that look like one
problem and are two, separated by whether a compiler flag could ever find them.

**40 unused declarations across 20 files**, every one a named-and-never-used import, invisible because
`tsconfig.json` sets `noUncheckedIndexedAccess` and `noImplicitOverride` and **neither
`noUnusedLocals` nor `noUnusedParameters`**. It is copy-paste debris rather than rot — three `.type.ts`
modules import the same six-name block from `core/llm` and each uses a subset. **Not an artefact of the
sweep**: 45 at the last wave's start, 40 now, the difference being five dropped when a file was folded.
The sweep made them countable, not numerous.

**And three exports with no consumer at all** — `ChatRole`, `codeOf`, `runWorkerTask` — which **no flag
will ever report**, because an `export` is used by definition. `runWorkerTask` is the instructive one: it
is the **only** construction site of `WorkerResult`, so that type is consumed nowhere either. **A dead
function was keeping a live-looking type alive behind it**, and deleting the function is what makes the
type's deadness visible.

**Ships after wave E, and the reason is the point of the item.** A barrel is what hides this class: while
`index.ts` re-exports a name, the name has an importer and nothing looks unused. Only once the last six
barrels are gone does *"exported and never imported"* become a meaningful search. Whether
`noUnusedLocals` goes on is the open decision, and `noUnusedParameters` wants a different answer, since
an interface-conforming callback often ignores an argument on purpose.

### 31. [The visible-turn predicate has two halves, and nothing checks they agree](visible-turn-predicate-has-two-halves.md)
*Memory / context.* The last surviving follow-up of [1](split-config-into-one-function-per-file.md), filed
as its own task now that item 1 has shipped — otherwise it would sit orphaned inside a file nobody has
reason to reopen.

*"Still in the phase's live history"* is defined **twice**: as SQL in `visible-turn-where.ts` for turns
read back from `memory.db`, and as JS in `visible-turns.ts` for turns still held in RAM. **They must agree
or a flush changes what a phase can see** — the same conversation gaining or losing a turn purely by
crossing the persistence boundary, which is the class of bug that cannot be reproduced from a transcript.
It **cannot be deduped**: one runs inside SQLite, one in Node.

Note the asymmetry a naive test would miss: SQL tests `IS NULL` on two columns, JS tests `=== undefined`
on two properties, and a row round-tripped through SQLite yields `null` rather than `undefined` — so **the
mapping layer between them is load-bearing** and only a test that reads a real row covers it.

**Blocked on the runtime, which is a user action.** It is the first test that would touch `node:sqlite`,
**experimental on 22.x and stable from 24**; the suite has only run on 22.14.0 while `.nvmrc` pins 24.14.0.
Two things make that sharper than it sounds: `npm test` invokes `node --test` directly and never passes
through `scripts/run.mjs`, the only thing enforcing the pin, and the `test` script passes
`--disable-warning=ExperimentalWarning`, switching off the one signal that would announce the experimental
API. **The duplication was always there; one file was hiding it** — the sweep made it addressable, not
riskier.

### 32. [Two unrelated types are both called `Phase`](two-unrelated-types-named-phase.md)
*Repo hygiene.* `src/phases/phase.ts` declares `interface Phase`, the phase abstraction a session runs
against. `src/core/session/phase.type.ts` declares `type Phase`, the closed six-name string union that is
the only valid inbox sender or recipient. **Two concepts, one identifier.**

Nothing is broken — no file imports both, so there is no shadowing and the type-checker has never had an
opinion. It is a legibility defect in a codebase whose whole convention is that a file's name states its
job.

**A barrel was hiding it.** While both directories had an `index.ts`, every consumer wrote
`from '../phases/index.js'` or `from '../core/session/index.js'` and the folder did the disambiguating;
deleting the barrels made every import name its file, and `phase.ts` beside `phase.type.ts` reads plainly.
It is also **exactly the class of problem an importer census cannot find** — a duplicated *declaration*
imports nothing — the same blind spot that hid a fourth copy of `KeypressListener` for two waves. **Second
time it has cost something**, which is the argument for filing it.

Filed rather than fixed because choosing **which** name moves is a judgement about what the two concepts
are called, and a rename touching every consumer of the union should not ride inside somebody else's
commit. The union sitting under `core/session/` while the abstraction sits under `phases/` may itself be
the thing to fix, in which case the rename question answers itself.

---

## Framing notes — not tasks

Neither is deleted when work ships; each goes when the last file it indexes is gone.

- **[harness-gaps-vs-claude-code.md](harness-gaps-vs-claude-code.md)** — the harness comparison: how far to
  trust it, and **what must not be traded away** while closing the gaps (per-phase tool allowlists as data,
  `verdictGitConflict`, exact token counts, the Retro loop, the audit log's single choke point, the Worker's
  persistent window). Read that section before starting anything in the sequence.
- **[ux-gaps-vs-claude-code.md](ux-gaps-vs-claude-code.md)** — the terminal-UX half, including where this
  product is ahead and where a difference is deliberate.

---

## How this order was derived

The four tiers are gone. They were a value-per-unit-of-work ranking made before the answer pass, and the
answers turned most of the ordering into something the files now state outright — so the sequence above
is read off the task files rather than re-judged.

**Stated in the files themselves.** Do not reorder these without going back to the file that says so:

| Constraint | Where it is stated |
|---|---|
| 1 before 12 | both files: the budget resolver is written into the shape, not moved into it |
| 3 before 6 | item 6: the Ollama check and the Node check *"should read as one family"* |
| 7 before 8 | both files: *"ship this task after the tokenizer, or the cap is written twice"* |
| 7 before 12 | item 7: *"any later budget, including the wall-clock work"* |
| 11 before 12 | #46, #64: item 11 owns the live `Ctx` field, item 12 consumes it |
| 11 before 13 | #91a: the live-window label is what makes steering legible |
| 11 before 20 | item 20: *"Build the reporting half first; it is free. Then decide with evidence."* |
| 5 and 12 read together | both files: one shared vocabulary for "ended without a verdict" |
| 9 after 8 | both files: a cap bounds index 1, a failsafe bounds what grows on top of it |

**Judgement, not statement.** These are the ones to overrule first, and none of them breaks anything
above if moved:

- **2 at position 2** — the earliest position it can hold. Nothing states it; the reason is that every
  later item changes a function on its list, so pinning them first is what makes those changes safe. The
  counter-argument is real and worth weighing when you answer its question: it is a body of work before
  any defect is fixed, and if the constitution amendment is declined the position is vacated anyway.
- **4 at position 4.** It could sit anywhere. It is early only because it is two predicates and a warning
  against a defect that is live in every project right now.
- **6 after 1.** Derived from the `ollama-models.ts` split that item 1 picked up under #94a — item 6's own
  file does not mention it, and would still build correctly first.
- **10 after 7.** Nothing states it. The reason is that item 10 makes a cost permanently resident in every
  window, which is easier to justify once the budgets it competes with are exact.
- **14 after 12.** Nothing states it. A `switch_phase` tool multiplies phase swaps, and both the
  transition line (#65) and the clock reset (#95b) are swap-aware behaviour that should exist first.
- **15 after 14.** Nothing states it either, and its own file offers no ordering — only that the question
  comes before the design. It is placed where phase lifecycle is already explicit, but it has no
  dependency that would break if it moved earlier.
- **16–19 among themselves.** Ordered by cost, not dependency. Only *19 after 9* has a reason — item 9 is
  what makes `memory.db` the store for everything a window said.

**Two items begin with a question, and the question is the work's first step.** Items 2 and 15 are
numbered like everything else because they are startable; what is different is that neither begins in an
editor. Whoever picks one up asks first and waits, since the answer decides whether the task exists at
all — an amended *Testing* section or a deleted file, a widened non-goal or a deleted file. Do not
design past the question, and do not answer it by inference from the docs.

**One ordering was overruled in practice, and the reason generalises.** The read-before-write guard was
pulled forward and shipped **before** `show-tool-calls-in-the-scrollback`, because the two wanted the same
container round-trip: `write_file` could not diff an overwrite without first reading what it was about to
destroy — which is the guard's read. **Two tasks that need the same fetch are one ordering decision, and
the one that makes the fetch happen goes first.** Worth checking for again before picking up any item
above.

**One lesson from the old tiering, kept because it was nearly acted on.** The symlink item was ranked low
partly on the argument that the exploit *"may not materialize on Windows at all"*. That was true of the
**link** and false of the **hole** — Windows is precisely where the host-side check could not see it, so a
host-only fix would have shipped believing it had closed something. A platform argument for deferring
work has to be an argument about the defect, not about the demonstration.

---

## Shipped or closed before this order was written

Kept in full. Several carry decisions that survive **only** here, and those are marked.

- [x] ~~**Cancel an in-flight turn**~~ — *Terminal UX.* Shipped: Ctrl+C stops the turn and a second press
      still quits, both Ollama paths carry an `AbortSignal`, `OLLAMA_TIMEOUT_MS` is a stall window, a
      cancelled exchange branches off the live history, and `/stop` · `/stop round` wind a batch down.
- [x] ~~**Bound `read_file`, and number its lines**~~ — *Memory / context.* Shipped: 250 lines or 5 000
      characters, whichever runs out first, with `offset`/`limit` the model can narrow but never widen.
      Output is line-numbered (`  12→`), every read ends with the range it showed and the file's total,
      and a line too long to finish resumes at `char_offset` so the notice always names a way forward.
- [x] ~~**Show what a tool call actually did**~~ — *Terminal UX.* Shipped: `→ <tool> <the one argument
      that names what it did>` before the call and `← <result>` after it, with a compact +/- diff under
      the write tools that collapses to `+12 −3` with the path above 20 changed lines or 2 000
      characters. A failure is red and says why, so a refused `edit_file` no longer reads like a
      successful one; a sub-agent's calls are indented and marked `[sub:…]`. A path is never truncated —
      the row wraps instead. The hook is `recordToolCall`, replacing every `appendAuditRow` site rather
      than the dispatcher's `onToolCall` seam, which would have missed all three runner-level refusals —
      the very calls the record exists for.
- [x] ~~**Let `list_files` see a subdirectory**~~ — *Harness capability.* Shipped: an optional `path` and
      a `depth` (default 1, so the bare call is unchanged), rendered as an indented tree with files before
      directories. Entries are filtered by the project's own `.gitignore` — read as a file, never
      `git check-ignore`, so an uncommitted file is never hidden — falling back to `SKIP_DIRS` when there
      is none, and `.git/` always. Capped at 500 entries, which says how many it left out. The
      `phase-tool-names.ts` comment that documented the hole as a policy choice is corrected.
- [x] ~~**Context lines and a cheaper default for `search_in_files`**~~ — *Harness capability.* Shipped:
      case-insensitive by default, `context_lines` with overlapping context merged, and an opt-in
      `output_mode:"paths"` — content stayed the default rather than becoming paths-only. The match count
      gave way to three caps (200 output lines · 200 matches · 20 per file), whichever fires first, and
      every result now closes with a line naming the cap that fired, or stating that none did. No regex.
- [x] ~~**Inspection commands**~~ — *In-app commands.* Shipped: `/tasks` renders the backlog as a compact
      epic/story tree carrying each task's status, order and unmet dependencies and marking the one
      `/run next` would pick; `/blockers` lists every open blocker with the exact `/answer` line to
      resolve it; `/inbox [<phase>|all]` opens the cross-phase channel the model could previously see and
      the user could not; `/batch [n]` re-prints a persisted summary through the same renderer that wrote
      it; `/audit [n]` shows the last N tool calls (default 20, uncapped). All pure reads — no new
      persistence, no model call, and none of them reachable by a phase. **`/batch` is removed again by
      [item 11](in-turn-progress-reporting.md)** (#92), which is where this entry gets corrected.
- [x] ~~**Make `edit_file` refuse an unread file**~~ — *Harness capability.* Shipped, and wider than the
      file asked for: **`write_file` is gated too**, branching on existence — creating is free, overwriting
      an existing file needs the same read. That was the file's own open question, and the answer came from
      asking why two tools do the same job: an unguarded whole-file overwrite is the most destructive thing
      the model has. Tracking is per WINDOW (a sub-agent's reads never satisfy its master's guard) and
      follows the phase CONTEXT — `/clear` and `/resume` empty it, `/swap` does not, and the Worker's
      survives all five rounds. Staleness is a content hash, not an mtime: both write tools already hold the
      bytes, so it costs no extra container round-trip and does not fire on a git checkout that rewrote a
      file to identical bytes. `rules/phases/` now tells the Worker, Design and Retro not to re-read a file
      to verify their own edit. **The `docs/sandboxing.md` and `docs/mental-model.md` diffs are
      review-gated and were left uncommitted.**
- [x] ~~**Close the symlink hole in path scoping**~~ — *Sandboxing / security.* Shipped, and by the larger
      of the two options: the file tools now do their work INSIDE the container rather than host-side, so
      `docs/sandboxing.md`'s original claim is true instead of merely asserted. Bytes cross as a tar stream
      over Docker's archive endpoints (`read_file`/`write_file`/`edit_file`); `list_files` and
      `search_in_files` are `find` and `grep -rl` in the sandbox, neither of which follows a link.
      `resolveInProject` was hardened anyway — it still scopes the host-side git tools. A live test proved
      the host check alone was not enough: a link planted from inside the sandbox does not materialize on
      NTFS, so a container-side `realpath -m` re-check is what actually closes it. **The `docs/sandboxing.md`
      diff is review-gated and was left uncommitted.**
- [x] ~~**Minor cleanups**~~ — *Repo hygiene.* Shipped, all three. `run.mjs` validates the project name
      against the same `SAFE_NAME` rule `/new-project` enforces and spawns argv arrays instead of formatted
      strings, which also closes a second hole the task file did not name: the same string reaches compose's
      mount path, where `../..` mounted a directory from OUTSIDE `projects/` at `/workspace`. `.gitignore`
      implements the `hello-world` exception it had only claimed — `projects/*` plus a negation, because git
      never descends into an excluded directory. The dead link in
      [switch-phase-tool.md](switch-phase-tool.md) now says its prerequisite landed. **One residue: on
      Windows `npm` is a `.cmd`, which Node refuses to spawn without a shell, so that one child keeps
      `shell: true` and the validation is what contains it. The `docs/repo-layout.md` diff is review-gated
      and was left uncommitted.**
- [x] ~~**Resolve the dead Tab completion**~~ — *In-app commands.* Wired back, and the shape is what made it
      possible: **Tab cycles.** It swaps the word under the cursor for the next candidate and wraps after the
      last, so nothing is ever printed and there is no candidate list to reconcile with the pinned rows or
      with the append-only scrollback — readline's own inline list was measured on the grid emulator
      stranding the input rule in history. Command names complete off the registry, so a newly registered
      command gets it for free; `/run` and `/answer` complete task ids from a sync backlog read; Shift+Tab
      stays unbound. **The `docs/cli.md` diff is review-gated and was left uncommitted.**
- [x] ~~**Evict stale tool results**~~ — *Memory / context.* Shipped for the **Worker**, whose window
      persists across all five rounds and had no bound at all. The KV-cache premise was verified first and
      it changed the design: a prefix rewrite really does force re-evaluation from the edit point (12.4s on
      a 14b, 31.3s on a 32b, against 0.07s to resend the same prompt), but the penalty is **one-time**, not
      per-turn, and it collapses to nothing when the cut is late — stubbing the newest tool result cost
      0.22s, less than a plain append. So the rule is a band: never rewrite anything in the older half of
      the window, always keep the newest 3 results, and never fire for fewer than 2 at once. A pass that
      would have to reach into the head **defers instead**. Tool results are stubbed by the rule *stub what
      the window learned, never what it did* (default-deny), the stub tells the Worker its read still
      satisfies the write guard so it is not tempted to re-read, and an `eviction_fire` event carries the
      exact before/after counts. The **dedupe-superseded-reads subset was dropped**, not deferred: a
      superseded read sits wherever it happens to be — usually early, which is exactly where the penalty
      lives and where the least is reclaimed — and `read_file`'s `offset`/`limit` mean two reads of one
      path are usually different slices rather than duplicates. **The `docs/mental-model.md` and
      `docs/cli.md` diffs are review-gated and were left uncommitted.**
- [x] ~~**Give each window its own `num_ctx`**~~ — *Memory / context.* Shipped, and narrower than the
      file asked: every model call now names its **role** from a closed union, and one table resolves that
      role to a ceiling. Only three roles differ from `OLLAMA_NUM_CTX` — the context titler,
      `search_rules` and the commit-message writer, at 8 192 — because only those three have an input
      with a known maximum. The measurement inverted the file's third bullet: `summarize` is handed ~half
      a window by construction and a `debate`'s material is uncapped, so a smaller ceiling there is
      silent truncation, not economy. Changing `num_ctx` rebuilds Ollama's runner (~3.3 s, against ~90 ms
      when unchanged), so ceilings vary by a lot and seldom rather than finely and often; what 8 192 buys
      is residency, not tokens. Every **window** role keeps the base by having no table entry at all, and
      `memory.ts` never imports the resolver — so the ceiling stamped on a phase context cannot drift from
      the one its turns ran under. The titler's transcript is head-bounded at 6 000 characters, which is
      what makes its smaller ceiling safe on the `/resume` re-title path.
- [x] ~~**Run the one-shots on a small model**~~ — *Memory / context.* **Closed without shipping**
      (OPEN-QUESTIONS.md #90a). The project's optimization target is now stated — *precision and accuracy over
      time taken* — and the acceptance test with it: *the output must be better; time is irrelevant.* Every
      argument the file made was a time-and-residency argument, and a 1.5–3b model does not write better
      titles, commit messages or summaries than the session model. The CPU-pinned arm was ruled out (#57)
      and the two small models were never pulled, so no benchmark was spent on it either. **The rest of
      section I survives only here:** the acceptance test was **output quality, with latency irrelevant**
      (#58), the latency numbers were **not worth recording** (#59), and if the lane is ever revived the
      build is **re-filed as its own task** (#60b) rather than smuggled into a measurement pass — it would
      need a second model resolution point, a second `activeModel`-shaped setting, a second `/models use`
      form, and token counts summed across two tokenizers.
- [x] ~~**Is 16 384 the right `OLLAMA_NUM_CTX`?**~~ — *Memory / context.* **Answered and closed: it stays
      at 16 384.** The benchmark ran on both models — 16 384 costs 29.1 % of generation throughput on the
      14b and 6.8 % on the 32b, and 12 288 is *not* fully resident either, so the choice was never
      resident vs. hybrid. The room is worth more than the speed, which is now the project's stated
      optimization target in `docs/product.md` along with the rule that resolved the CPU collision —
      *spill is acceptable while the weights stay resident and only KV cache offloads* (#84c). Nothing to
      migrate. Spun out **item 4**, since shipped, and handed
      the residency measurements and the boot probe to
      [boot-can-pick-a-toolless-model.md](boot-can-pick-a-toolless-model.md), which is where the tag is
      painted. **Three decisions survive only here, so do not re-open them without reading this line:**
      **per-model ceilings are deferred** (#37a) — one global number is demonstrably wrong for one of the
      two models, 29.1 % against 6.8 %, but a ceiling that follows `/models use` changes *mid-session*
      while `contexts.num_ctx` is stamped *once at creation*, so it would drag the stamping design with
      it; **16 384 is the number that is right for the 32b** and expensive on the 14b, which #37a asked to
      be recorded; and **`OLLAMA_KV_CACHE_TYPE` is not a backlog item** (#85c) — it folds into the
      residency rule, being the one knob that shrinks the *cache* spill without touching the weights.
