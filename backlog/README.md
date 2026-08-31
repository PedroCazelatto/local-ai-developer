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

### 1. [Split `config.ts` into one function per file](split-config-into-one-function-per-file.md)
*Repo hygiene.* **Widened, and partly landed.** The four-function env-resolution exception is over:
`resolveNumCtx`, `resolveRatio`, `resolveTimeoutMs` and `loadConfig` each hold their own file, `config.ts`
keeps the `DEFAULT_*` constants and re-exports them, and `ollama-models.ts` is gone — `list-models.ts`,
`has-model.ts` and `pull-model.ts` over a shared `daemon.ts` value module. That is item 1's **first
increment, not its completion**, which is why this line is not struck and the task file is still here.

**What the first increment found.** #94's answer said *"after it, no multi-function files remain in
`src/`"*. That was never true. **95** of the 212 code files under `src/` declare more than one function —
**461** functions between them — and **27** export more than one: `memory-db.ts` 11, `renderer.ts` 10,
`project-git.ts` and `backlog.ts` 8 each. `config.ts` and `ollama-models.ts` were only the two that had
*written the exception down*.

**So item 1 is now the whole sweep, at the wider bar — any function declaration, not just an exported
one**, which is the bar `config.ts` was judged by, since its three resolvers were private. It absorbs a
second reversal: **types no longer live in `.type.ts` siblings**, they live in the file that owns the
function, so the **55** sibling type files fold in as the sweep reaches them. `constitution.md` and
`CLAUDE.md` state the opposite today; the amendment is drafted, review-gated, and **must be reviewed
before any sweep work begins**. The task file carries the per-directory census the sweep is partitioned
across.

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
