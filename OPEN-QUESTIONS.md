# Open questions — Tier 2 & 3 investigation pass

Ten agents each read one backlog task and came back with 73 questions. This file is now the **single
place they live**: the follow-ups that used to sit in a separate `FOLLOW-UP-QUESTIONS.md` are folded
into the sections they belong to, keeping their numbers.

**Every question has been rewritten to explain itself.** The first pass assumed you were holding the
codebase in your head, and it shows: #2 you told me outright you could not follow, and #15 was answered
against a different question than the one asked. So each entry now carries four things.

- **Today** — what the code actually does, and the file that does it. No question asks you to guess.
- **Why this is a question** — the tension that makes it a decision rather than an implementation detail.
- **Options** — each followed by what choosing it actually costs.
- **Your answer**, where there is one, and what it changed.

## How to answer

Answer by number in [ANSWERS.md](ANSWERS.md) — `12: b`, or free text where a letter does not fit
(`12: refuse, and name the model in the line`). **Numbers never change**, so an answer given earlier
still points at the same question even though the text around it has grown.

Three kinds of entry:

| Mark | Means |
|---|---|
| ✅ | Answered. The answer is quoted, and what it changed is named. |
| ⚠️ | Answered, **but the answer needs a second look** — it contradicts another answer, it answered a different question than the one asked, or it picked an option whose consequences were not visible at the time. |
| ◻️ | Open. No agent will fill it with a default. |

Anything you skip stays blocked.

## Map

| § | Task | Questions | State |
|---|---|---|---|
| ⚠ | benchmark pull vs. the boot pick | #1 | answered; the actual pull is still undecided |
| A | record-attempted-tasks | #2–#6, #70 | **#2 open and it is the centre of the task**; #4 opened #70 |
| B | boot-can-pick-a-toolless-model | #7–#14, #69, #71, #72 | answered; two answers collide, three follow-ups |
| C | node-version-is-not-enforced | #15–#21, #73–#76 | answered; #15 is still unanswered in fact, four follow-ups |
| D | spawned-windows-have-no-failsafe | #22–#27 | open — the sequencing keystone for E, F, H, I |
| E | cap-the-debate-background-parameter | #28–#34 | open |
| F | tune-the-global-num-ctx-default | #35–#37, #68 | open — benchmark finished, number not chosen |
| G | budget-ceilings-for-runs-and-batches | #38–#47 | open — follows A, which sets its vocabulary |
| H | surface-matching-standards | #48–#56 | open |
| I | small-model-lane-for-one-shots | #57–#60 | open — held on #1 |
| J | in-turn-progress-reporting | #61–#67 | open |

**Where the new numbers went:** #68 into F, #69/#71/#72 into B, #70 into A, #73–#76 into C. Nothing
was renumbered.

---

## ⚠ #1 — Pulling a small model changes what an unattended boot selects

**Today.** `pickSmallestModel` ([src/core/llm/pick-smallest-model.ts](src/core/llm/pick-smallest-model.ts))
sorts the installed set on `size` — on-disk bytes — and returns the first one. `resolveBootModel`
reaches for it in two places: when `state.json` has no `activeModel` at all, and when it has one that
is no longer installed and you decline the re-pull. Nothing on this box is under 8.9 GB today, so the
rule currently picks a large model because there is nothing else.

**Why this is a question.** Two Tier-3 tasks want small models pulled *as measurement instruments*:
task F (`num_ctx` tuning) and task I (a small-model lane for one-shots), for which you already
authorized `qwen2.5-coder:1.5b` and a 3b. The moment either lands on disk it becomes the smallest thing
installed — so the next boot on a fresh `state.json` runs the entire product on a 1.5b model. That is a
live behaviour change caused by a benchmark, and it belongs to neither task that requested it.

**Options.**

- **a.** Pull anyway; task B's tool-capability filter will exclude the ones that cannot call tools when
  it lands. *Cost: leaves a window where the boot pick is a benchmark artifact, and only helps if the
  small models turn out to be toolless — a 1.5b that does report `tools` would still be picked.*
- **b.** Pull, and teach `pickSmallestModel` to exclude benchmark-only models as part of task B. *Cost:
  needs a durable notion of "benchmark-only" — a list somewhere, which is a new concept in the repo.*
- **c.** Pull, and set `activeModel` explicitly first so the pick rule never fires at all. *Cost: none
  in code; it is one `/models use` before the benchmark. Relies on `state.json` staying put.*
- **d.** Something else.

**Your answer:** *"If the state.json already has a model, use it. If we are on an empty machine, suggest
one to download. Never pull a model without user approval."*

**⚠️ Worth re-checking.** That describes the **boot ladder**, and it is now written into
[docs/cli.md](docs/cli.md) as the invariant *nothing is ever pulled without approval*. But the question
was about **the benchmark pull**, and three things are still undetermined:

1. **Are the two small models pulled at all?** Read literally, "never pull without user approval" makes
   this request the approval — and it has not been granted. Task I's benchmark is explicitly held here,
   and stays held until you say.
2. **If they are pulled, does `activeModel` get set first** (option c), so the smallest-model rule never
   fires on a measurement artifact?
3. **Does anything in the code change**, or is this purely a procedural answer? (a) and (b) both mean
   code; (c) and "don't pull" mean none.

A one-line answer settles it: *"pull them, set activeModel first, no code change"* — or *"don't pull;
the deferral stands."*

---

## A. record-attempted-tasks — Tier 2, Execution loop

**What the task is.** A task that fails review five times over is set back to `pending`, which makes it
look untouched. Give it a durable record of having been tried, so an unattended `/run all` stops
re-failing last night's work.

**The mechanical obstacle that shapes every question here.** `stashTaskAttempt`
([src/core/session/project-git.ts](src/core/session/project-git.ts)) is `git stash push -u` over the
**whole tree**. Anything the loop writes into a task's frontmatter *before* that call is reset to HEAD
and disappears with the failed attempt. So "where does the record live" is not a style question — most
of the obvious answers do not survive.

**#4 decides whether the rest are even the right questions.**

### ◻️ #2 — What is actually written into the task file? *(open — this is the centre of the task)*

You answered *"I didn't understand"*. Here it is with the machinery spelled out.

**Today.** Every task in a project's backlog is one Markdown file whose frontmatter drives scheduling:

```yaml
---
status: pending          # the ONLY four values allowed
order: 1                 # global execution sequence
depends_on: []           # task ids that must be done first
---
# Short task title
```

`TaskStatus` ([src/core/session/types.ts](src/core/session/types.ts)) is the closed union
`'pending' | 'in_progress' | 'done' | 'blocked'`, and `TASK_STATUSES` lists the same four for the
validator. When a task burns all five review rounds, `run-task-loop.ts` sets it back to **`pending`**.
`resolveSelector('all')` then takes everything that is not `done` — so tomorrow night it is picked up
again, indistinguishable from a task nobody has ever run, and another five rounds are spent failing it
the same way.

**Why this is a question.** There is no field to write "tried and failed" into. One has to be invented,
and the two candidate shapes have very different blast radii.

**Options.**

- **a. A new status value** — `status: failed`, or whatever it gets called.
  - *For:* one word, in the field that already drives scheduling. `/tasks` prints it with no extra work,
    and a human opening the file sees it at once.
  - *Against:* `TaskStatus` is closed, and a fifth member breaks every place that enumerates it —
    `TASK_STATUSES`, the frontmatter validator, the exhaustive `Record` in `render-task-tree.ts`,
    `taskSkipReason`, `resolveSelector`, and the Breakdown phase's template that tells the model which
    values are legal. All mechanical, but all of it, and the Breakdown template means the *model* has to
    be taught the new word too.
  - *Also:* **it needs a name and the repo has no precedent.** `failed`? `escalated`? `attempted`?
    `exhausted`? Name it if you pick this.
- **b. A count only** — leave `status: pending` and add `attempts: 2`.
  - *For:* nothing that switches on status changes at all. Least invasive by a wide margin, and it
    carries strictly more information than a boolean status ever could (twice vs. five times).
  - *Against:* `/tasks` still renders the task as `pending`, with "…but tried twice" as a separate
    column. A task that failed twice reading as `pending` is close to the confusion this task exists to
    remove.
- **c. Both** — `status: failed` **and** `attempts: 2`. The full cost of (a), plus the count.

**Why nothing else in this task can be built first.** You answered #5 with "`/run all` skips
previously-failed tasks by default" — the skip has to *read* something, and this is that something. And
#4 decided the loop *writes* something after the stash — this is what it writes.

### ✅ #3 — What does re-running a failed task mean?

**Today.** `/run <id>` runs one task through `runOneTask`. Nothing distinguishes a first attempt from a
tenth. The previous attempt was stashed under `lad-stash:<taskId>` and is **never handed back** — a
fresh Worker window redoes the task from nothing, deliberately: a Worker given its own failed attempt
tends to converge on it rather than past it. The stash exists for Retro to read (on a blocker) and for
you to inspect (on an escalation).

**Why this is a question.** Once a task is marked as having failed, re-running it could reasonably mean
"try again as if new", "refuse unless I insist", or "try again and keep score".

**Options.**

- **a.** Retry from scratch, as today. *Cost: none — it is current behaviour.*
- **b.** Refuse without an explicit flag. *Cost: needs a flag, and `/run` has no flag parser at all.*
- **c.** Retry, but keep counting. *Cost: only meaningful if #2 lands on a count.*

**Your answer: a — retry from scratch.** Written into
[docs/phases.md](docs/phases.md): naming a task explicitly *is* the "I fixed the spec, try again"
gesture, and it needs no flag to say so.

### ⚠️ #4 — Where does the record live, and who makes it durable?

**Today.** Three things write to a project's git state during a run, and they are deliberately separated:
the **Reviewer** commits the files it accepts (the only committer in the execution loop), **Retro**
commits its own edits, and the **orchestrator** commits nothing — it stashes what is left. The task file
itself is touched by `setTaskStatus`, which the Reviewer's `mark_task_done` also drives.

**Why this is a question.** The stash wipes the tree, so the write has to happen after it — and
everything that happens after the stash is, by definition, outside what the run just cleaned up.

**Options, and what each actually costs.**

- **a.** The loop commits the frontmatter itself via `commitPaths`. *Cost: a **second**
  orchestrator-side committer beside Retro's, and it amends "Who may commit" in `docs/phases.md` — a
  policy the repo states carefully.*
- **b.** The Reviewer writes it. *Cost: it is **absent on exactly the paths that need it**. A
  MAX_ROUNDS exhaustion and an infra error both end without a Reviewer verdict, and those are the two
  cases where a record matters.*
- **c.** A git-ignored file under `.orchestrator/`. *Cost: durable and it survives the stash — but
  invisible in the committed backlog file, so `git log` never shows that a task was attempted, and the
  file that drives scheduling still says `pending`.*
- **d.** Write after the stash and accept a permanently dirty tree. *The original note said the
  pre-flights refuse this, so it looked non-viable.*

**Your answer: d.**

**⚠️ Worth re-checking — and it opened #70.** (d) is buildable, and it is the only option that keeps the
record in the committed backlog without adding a committer. But the note was right that today's code
refuses it: **three separate gates halt on a dirty tree**, and all three would fire on the very file the
loop just wrote. #70 below is that decision. If you would rather not take on #70, **(a) is the fallback**
— one new committer, and the tree stays clean.

### ✅ #5 — Is skipping previously-failed tasks the `/run all` default, or opt-in?

**Today.** `resolveSelector` accepts exactly three shapes: `next`, `all`, or a bare task id. There is no
flag syntax anywhere in `/run`, no parser for one, and the Tab completer offers only those three shapes.

**Why this is a question.** The two use cases pull opposite ways. The unattended overnight batch wants
failed tasks skipped, or it re-burns the night. The "I just fixed the spec, try them again" case wants
them included.

**Options.**

- **a.** Default: `/run all` skips them. *Cost: none new — and `/run <id>` remains the deliberate retry.*
- **b.** Opt-in via a flag. *Cost: a flag spelling to invent, plus the parser, the completer, the usage
  string and the docs that go with it.*

**Your answer: a.** Written into [docs/phases.md](docs/phases.md). The retry path is `/run <id>`, which
needs nothing new.

### ✅ #6 — The apparently-unreachable empty-diff escalation

**Today.** The loop calls `setTaskStatus('in_progress')` when a task starts, which **modifies the backlog
file** and leaves it modified for the whole run. Later, an escalation path checks
`changed.files.length === 0` to detect "the Worker produced nothing" — but the dirty task file is itself
a change, so that count is never zero in round 1. The same dirty file also lands in the diff the Reviewer
is shown.

**Why this is a question.** It looks like dead code, but it was found by reading, not by running, and it
sits next to what this task touches.

**Options.** **a.** Fix it here · **b.** Its own backlog file · **c.** Leave it.

**Your answer: c — leave it.** Not this task's problem; recorded in the task file so the next reader does
not re-derive it.

### ◻️ #70 — #4d leaves the tree dirty, and three gates halt on a dirty tree

**Today.** Three places refuse to proceed when `isWorkingTreeDirty` returns true:

1. **`preflightRefusal`** ([src/core/session/batch.ts](src/core/session/batch.ts)) — refuses to *start*
   a batch at all, with `PREFLIGHT_DIRTY_WARNING`.
2. **The per-task check inside the batch loop** — skips each task whose turn comes up on a dirty tree,
   because "its review cannot be isolated". After one escalation, that is **every remaining task**.
3. **`runOneTask`'s `HALT_DIRTY`** ([src/interface/commands/run.ts](src/interface/commands/run.ts)), and
   **`git_branch`'s** refusal to `switch` onto an existing branch with uncommitted work.

Each exists for the same reason: a review has to capture exactly one task's changes, so a stray edit in
the tree corrupts the judgement.

**Why this is a question.** #4d writes one file and leaves it there. Left alone, the first escalation in
an overnight batch silently ends every run that follows it — the failure mode this whole task exists to
remove, in a new costume.

**Options.**

- **a.** A path allowlist — the dirty checks ignore backlog task files specifically. *Cost: simple, but
  it also blinds them to a genuine stray edit in a task file.*
- **b.** The batch carries a **known-modified set**: exactly the paths it wrote itself are tolerated,
  anything else is still a stray change. *Cost: more plumbing (the set has to be threaded from the write
  to all three gates), but it stays honest — it tolerates only what it can account for.*
- **c.** The gates stay strict and the record is committed after all — which **reopens #4** in favour of
  (a) there: the loop commits the frontmatter, a second orchestrator-side committer, and
  `docs/phases.md`'s "Who may commit" gets amended.
- **d.** Something else.

---

## B. boot-can-pick-a-toolless-model — Tier 2, Model behavior

**What the task is.** Every phase in this product is a tool-calling loop. A model that cannot call tools
cannot do *anything* here — a Worker without `edit_file` writes no code — yet the boot pick sorts on disk
size and never asks what a model can do.

**Confirmed live, not inferred.** On this box `deepseek-coder-v2:16b` reports capabilities
`completion,insert` — **no `tools`** — and it is what a fresh `state.json` currently boots on, because it
is the smallest thing installed. The first tool-capable model is 83 MB larger.

**Where the work actually is.** `listModels`
([src/core/llm/ollama-models.ts](src/core/llm/ollama-models.ts)) projects each model down to
`{ name, size, modifiedAt }` — the capability is **dropped before `pickSmallestModel` ever sees it**, so
`InstalledModel` grows a field first. And there are **four call sites, not one**: the saved-model branch,
the re-pull branch, the pick rule, and `/models use`.

### ✅ #7 — No installed model has `tools`. What does boot do?

**Today.** `resolveBootModel` can already return `undefined`, and the REPL handles it: the status line
reads `no model`, a turn fails with an actionable "pull one" line rather than an Ollama 404, and
`/models pull` still works. That path exists for the empty-machine case and is proven end to end.

**Why this is a question.** A machine full of models, none of which can run a phase, is a new state. It is
not "nothing installed", and it is not a working session either.

**Options.**

- **a.** Refuse to boot. *Honest, but it kills `/models pull` — the only way to fix the problem from
  inside the app.*
- **b.** Boot model-less. *Reuses machinery that already works. Costs you the ability to chat with the
  toolless model at all.*
- **c.** Boot on the smallest anyway, loudly warned. *Chat half-works; every phase fails on round 1 —
  after burning rounds looking confused, which is the failure mode being removed.*

**Your answer:** *"Boot model-less **and refuses** to `/models use` to any model that does not have
tools."* → **(b)**, plus a ruling on `/models use`.

Written into [docs/cli.md](docs/cli.md) as ladder step 6. **The second half of your sentence collides
with your #11 answer — see #69.**

### ✅ #8 — What does the failure line say, and what does it tell you to pull?

**Today.** `SUGGESTED_MODEL` ([src/core/session/config.ts](src/core/session/config.ts)) is
`qwen2.5-coder:3b`. It exists *only* as the download suggestion for a machine with nothing on it, and is
never a value the session silently boots on. It is **not installed here**, so its tool support has never
been verified.

**Why this is a question.** "Pull something" is useless advice; naming a model whose capability you have
not checked just moves the failure one pull further along.

**Options.** **a.** Reuse `SUGGESTED_MODEL` · **b.** Name a different model — *which?* · **c.** Name none;
say "pull a model with tool support".

**Your answer: c.** [docs/cli.md](docs/cli.md) now distinguishes the two failure lines: an **empty
machine** still gets `SUGGESTED_MODEL` by name (your #1), while **models installed but none capable**
gets "pull a model with tool support" and names nothing.

### ✅ #9 — Does the filter apply to a saved `activeModel` in `state.json`?

**Today.** `resolveBootModel`'s first rule returns the saved model the moment it is found installed, and
the code comments that "the user's own explicit choice always wins". Only `/models use` ever writes that
field, so it is always a stated choice, never an inferred one.

**Why this is a question.** Honouring an explicit choice is a principle the file states outright. But a
saved toolless model produces a session where every phase fails — the choice cannot be honoured and be
useful at the same time.

**Options.** **a.** Honour it silently · **b.** Honour it with a warning · **c.** Refuse it and fall
through to the pick rule.

**Your answer: c.** Ladder step 2 in [docs/cli.md](docs/cli.md): an explicit choice outranks an inferred
one *only among models that can run a phase*.

### ⚠️ #10 — Same question for the re-pull offer of a saved-but-missing model

**Today.** Ladder step 2 of `resolveBootModel`: when the saved model is not installed (deleted, or pulled
on another machine), it prints `Saved model 'X' isn't installed.` and offers a single-keypress y/n
re-pull. Decline, and it falls through to the pick rule with no second offer.

**Why this is genuinely harder than #9.** A model that is **not on disk reports no capabilities at all** —
Ollama can only describe blobs it has. So "apply the filter" has no meaning until after the download.

**Options.** **a.** Honour silently · **b.** Honour with a warning · **c.** Refuse and fall through.

**Your answer: c.**

**⚠️ Worth re-checking — this became #69's sibling, #71.** "Refuse it" has two readings and they behave
very differently:

- **a.** Offer the re-pull as today, then apply the gate **after** the pull — a re-pulled model that turns
  out toolless is refused, and boot falls through to the pick rule. *This is what
  [docs/cli.md](docs/cli.md) now says.* It keeps your #1 ("on an empty machine, suggest one to download")
  intact.
- **b.** Refuse the offer outright, because unverifiable capability is fail-closed under your #13. *This
  removes the re-pull offer entirely* — a saved model that vanished is never offered back.

**#71 is that choice.** Answer `71: a` or `71: b`.

### ✅ #11 — Does `/models use <name>` get the check?

**Today.** `useSubcommand` ([src/commands/models.ts](src/commands/models.ts)) checks one thing: whether
the model is pulled. If it is not, it offers an inline single-keypress download and then switches.
Capability is never consulted. On success it calls `orch.useModel(name)` and persists to `state.json`.

**Why this is a question.** A deliberate choice is not an inferred default — but the resulting session is
identically broken either way, and `/models use` is also the **only** way to select a toolless model on
purpose (to chat with it, since chat does not need tools).

**Options.** **a.** Refuse · **b.** Warn and switch anyway · **c.** Single-keypress confirm, then switch.

**Your answer: c.** Written into [docs/cli.md](docs/cli.md) — *but it contradicts #7. See #69.*

### ✅ #12 — Where does the warning live so it survives `clearScreen`?

**Today.** The REPL calls `clearScreen` **once**, after boot, before the prompt opens — so every line
printed during model resolution is wiped before you can read it. What survives is the pinned status bar:
`updateStatus` ([src/interface/repl.ts](src/interface/repl.ts)) paints
`Model: <model> | Project: <project>`, with `no model` when none is selected.

**Why this is a question.** A warning you cannot scroll back to is not a warning.

**Options.** **a.** A scrollback line beside the existing "no model selected" hint · **b.** A marker in
the pinned status line (`Model: … (no tools)`) · **c.** Both.

**Your answer: b.** [docs/cli.md](docs/cli.md) documents `Model: <name> (no tools)`. **Note the
dependency:** this marker can only ever be painted if a toolless model is allowed to become active — so
it lives or dies with #69.

### ✅ #13 — A daemon that does not report `capabilities` at all — fail open or closed?

**Today.** This box runs Ollama 0.32.9, which reports the field. Older daemons predate it. The repo
declares **no minimum Ollama version anywhere** — not in `README.md`'s Requirements, not at boot.

**Why this is a question.** A strict filter on an old daemon reports "no capable model" on a machine full
of working ones. A lax filter puts you back where the task started.

**Options.** **a.** Fail open (absent = assume capable) · **b.** Fail closed (absent = assume incapable).

**Your answer: b.** [docs/cli.md](docs/cli.md) records it with the reason: booting a walk-away batch onto
a model that cannot call a tool costs the whole batch, while a wrongly model-less boot costs one
`/models use` — the cheap direction to be wrong in. **The consequence is #72.**

### ✅ #14 — Should `/models list` show tool support?

**Today.** `listSubcommand` prints name, size and last-modified, with a `●` on the active one. The task
file never asked for a capability column.

**Why this is a question.** Once models are being skipped, the list is where a user goes to ask why.

**Options.** **a.** Add a column/marker · **b.** Leave the list untouched.

**Your answer: a.** Documented in [docs/cli.md](docs/cli.md).

### ◻️ #69 — `/models use` on a toolless model: refuse, or confirm-then-switch?

Two of your answers point opposite ways and both cannot hold:

- **#7:** "Boot model-less **and refuses** to `/models use` to any model that does not have tools."
- **#11:** **c** — "Single-keypress confirm, then switch."

I wrote **#11c** into the docs, on one piece of evidence: your **#12** answer puts a `(no tools)` marker
in the pinned status line, and that marker can only ever appear if a toolless model is allowed to become
active. Under a refusal it is unpaintable — dead code. But that is an inference from a third answer, not
something you said.

- **a.** Confirm-then-switch (what the docs now say). The `(no tools)` marker is the ongoing reminder.
- **b.** Refuse outright — and **#12's status marker is dropped**, since nothing could ever paint it.
- **c.** Refuse, but keep the marker for some other case — *name the case.*

### ◻️ #71 — #10's "refuse it": kill the re-pull offer, or gate what comes back?

Stated in full under #10 above. **a.** Offer, then gate after the pull (docs' current reading) ·
**b.** Refuse the offer outright, removing the re-pull path entirely.

### ◻️ #72 — Fail-closed means the repo now needs a minimum Ollama version

**Why this exists.** Your **#13b** makes "your daemon is too old to report capabilities" equivalent to
"no model on this machine can run this product". That is a real, silent failure mode on a machine that
works fine — and the repo currently states no Ollama floor at all, so nobody would know to look.

**Options.**

- **a.** State a minimum Ollama version in `README.md`'s Requirements **and** check it at boot, the way
  an unreachable Ollama daemon is already fatal at boot.
- **b.** State it in the docs only — no check.
- **c.** Neither. The model-less boot plus its "pull a model with tool support" line is explanation enough.
- *If (a) or (b): **what version?** I have not verified which Ollama release first reported
  `capabilities`, and that needs checking rather than guessing — say the word and I will find it.*

---

## C. node-version-is-not-enforced — Tier 2, Repo hygiene

**What the task is.** The Node version is declared in **four** places and enforced in none.

| Where | What it says |
|---|---|
| `package.json` `engines` | `>=24` — advisory only, unless `engine-strict` is set |
| `.nvmrc` | `24.14.0` — read by version managers, if the shell is configured to |
| `docker-compose.yml` | `node:24-slim` — the root sandbox image |
| `README.md` Requirements | "Node 24 LTS" |

This machine runs **v22.14.0** and nothing notices.

**The original premise was disproved.** The task was filed believing 24 was required because `node:sqlite`
is unflagged there, and that `npm run start` on 22 would therefore fail opening `memory.db`. **It does
not.** `node:sqlite` works on v22.14.0, and nothing in `src/` needs Node 24. You then ruled: **keep
`>=24`, and give the check a different justification** (recorded in *Already answered* #3). The
justification now on record is that a version declared four times and enforced zero times tells you
nothing about what the code was tested on.

### ⚠️ #15 — Where does the check live?

**Today.** `scripts/run.mjs` is the launcher, with three verbs — `install`, `start`, `stop`. It imports
nothing beyond Node builtins, deliberately, and already carries one deliberate duplication: `SAFE_NAME`,
copied with a "change one, change the other" comment. `src/index.ts` runs the boot sequence and holds the
existing `fail()` calls, but it runs **after** Docker comes up.

**Why this is a question.** A version check is only useful at the very front. Every candidate location
trades that off against knowing the range.

**Options.**

- **a.** `scripts/run.mjs` — runs first, dependency-free, but has to get the range from somewhere.
- **b.** `src/index.ts`, beside the existing `fail()` calls — can read `package.json` directly, but runs
  after Docker is already up, which the task file calls "the wrong end of the problem".
- **c.** `.npmrc` `engine-strict=true` — free, but fires **only on install** and prints npm's generic
  message rather than one naming the reason.
- **d.** More than one of these — *which?*

**Your answer:** *"Docker must use the node version of .nvmrc."*

**⚠️ This answered a different question.** It is a genuinely useful decision and it is now written into
[docs/cli.md](docs/cli.md) and [docs/sandboxing.md](docs/sandboxing.md): **`.nvmrc` is the single source
of truth, and the sandbox image tag derives from it** instead of floating on a major-only tag. It also
opened #76 (*how* compose reads it).

But #15 asked **where the host-side version check lives**, and that is still unanswered. Your #16 and
#17 both describe behaviour of a check in `run.mjs`'s verbs, which implies **(a)** — so the docs assume
(a). One letter confirms it, or names another.

### ✅ #16 — Which entry points are gated?

**Today.** `run.mjs` dispatches on three verbs: `install` (npm install + pull the sandbox image), `start`
(brings Docker up, then boots the session for a project), and `stop` (shuts Docker down).

**Why this is a question.** Each verb has a different exposure. `start` is where a walk-away batch begins.
`install` is where dependencies are built. `stop` is a teardown that must work in every circumstance,
including a broken one.

**Options.** **a.** All three · **b.** `install` + `start` · **c.** `start` only.

**Your answer: c — start only.** See **#73**: this needs reading alongside #17.

### ✅ #17 — Refuse, or warn?

**Today.** Nothing checks, so nothing refuses. With the floor kept at `>=24` and the `node:sqlite`
failure disproved, a hard refusal makes this repo unrunnable on this machine today for a failure that
does not occur.

**Why this is a question.** "Start a batch and walk away" argues for refusing at the front rather than
failing at the back. Against that: the refusal would be for a fault nobody has observed.

**Options.** **a.** Hard `process.exit(1)` · **b.** Warn and continue · **c.** Refuse on `start`, warn on
`install`.

**Your answer: c.** Reconciled with #16 by reading "gated" as "refused": **`start` refuses, `install`
warns and continues, `stop` is untouched.** That is what [docs/cli.md](docs/cli.md) says — confirm at
**#73**.

### ✅ #18 — Exact wording, and does it still name `node:sqlite`?

**Your answer: b — draft it and show me for review.** Drafted at **#74**.

### ⚠️ #19 — Does the `.nvmrc` finding change the task?

**Today.** `.nvmrc` pins `24.14.0` and the original task file never mentioned it. A version manager only
honours it if the shell is configured to — `nvm use` on entering the directory, or a shell hook that does
it automatically. Nothing in the repo can make that happen.

**Why this is a question.** If the real cause is "the shell was never switched", then a check inside the
process is treating a symptom.

**Options.** **a.** The real fix is making the shell honour `.nvmrc` — machine setup, no code ·
**b.** Still an in-process check · **c.** Both.

**Your answer: a.**

**⚠️ Worth re-checking.** Read literally, (a) — "**no code**" — removes the check entirely and makes
#16, #17 and #18 moot, yet you answered all three as though a check ships. I have written it as **both**:
the shell fix is the remedy, and `run.mjs`'s check is the backstop for a shell nobody switched. **#73**
asks you to confirm that.

### ✅ #20 — Do the stale premises get corrected, or just dropped?

**Today.** Both the task file and its line in [backlog/README.md](backlog/README.md) assert the
`node:sqlite` failure that does not occur.

**Options.** **a.** Correct them in the shipping commit, then delete the task file · **b.** Delete the
task file and rewrite the README line to describe what was actually found.

**Your answer: a.** The task file now carries the correction outright (it is the working document, and it
is deleted at ship time anyway); `backlog/README.md`'s line is corrected **in the shipping commit**, as
you asked.

### ✅ #21 — May the agent touch `README.md`?

**Today.** `CLAUDE.md` forbids editing `README.md` unasked. Its "Node 24 LTS" line is one of the four
version declarations, and its Commands section lists `npm run sandbox:up` / `sandbox:down`, which are not
in `package.json`.

**Your answer:** *"No, you need to create a file with readme inconsistencies and I will fix them."*

**Done** — [README-INCONSISTENCIES.md](README-INCONSISTENCIES.md), 13 items, worst first. It turned out to
be much larger than the two lines the question named: the README describes a **Python** app using
**Rich**, its folder tree is from a repo that no longer exists, `[config.ts](config.ts)` is a dead link to
a hardcoded model that was deliberately removed, and "model management commands are planned but not yet
implemented" is false. Each item names where the truth lives, and the file ends with what is still
accurate.

### ◻️ #73 — #16 vs #17 vs #19: confirm how they fit together

Three answers, and taken at face value they do not compose. #16 says **`start` only**; #17 says **refuse
on `start`, warn on `install`** (two verbs); #19 says **no code at all**.

What the docs currently say — my reconciliation: **the shell fix is the remedy; a `run.mjs` check ships
as the backstop; `start` refuses; `install` warns and continues; `stop` is never gated.**

- **a.** Correct as written.
- **b.** `start` only — `install` says nothing at all.
- **c.** No check ships. Shell setup only, and #15–#18 are dropped.

### ◻️ #74 — The Node version wording, for review *(this is #18b)*

No longer names `node:sqlite`, since that is no longer the reason.

**Refusal, on `start`:**

```
✗ Node >=24 is required — found v22.14.0.

  This repo pins 24.14.0 in .nvmrc. Run `nvm use` in this directory (or the equivalent
  for your version manager) and start again.
```

**Warning, on `install`:**

```
⚠ Node >=24 is expected — found v22.14.0. Continuing.
  `npm run start` will refuse until you switch; see .nvmrc.
```

- **a.** Take both as drafted.
- **b.** Change the wording — *say how.*
- *Separately:* the refusal names **two numbers** — the range `>=24` (from `engines`) and the pin
  `24.14.0` (from `.nvmrc`). Now that `.nvmrc` is the source of truth, should it just say `24.14.0` and
  drop the range?

### ◻️ #75 — Where does `run.mjs` get the version from?

Follows directly from #15 making `.nvmrc` the source of truth.

- **a.** `run.mjs` reads `.nvmrc` — a dependency-free `readFileSync`, one source of truth, nothing to
  drift. *Cost: the launcher grows a file read, and has to cope with `.nvmrc` being absent or malformed.*
- **b.** The range is duplicated inline, following the `SAFE_NAME` precedent already in that file. *Cost:
  a second copy of the version, which is the problem this task is about.*
- **c.** Read `.nvmrc` for the pin and keep `engines` for the range — both, each from its own home.

### ◻️ #76 — How does `docker-compose.yml` get it?

**Why this exists.** Compose cannot read a file into an image tag on its own, so #15's decision needs a
mechanism. Note the compose file already interpolates one env var the launcher sets — `ACTIVE_PROJECT`,
with a fail-closed `:-__no_project__` default — so the pattern exists.

- **a.** `run.mjs` exports the version and `image:` interpolates it. *One source of truth, and it matches
  how `ACTIVE_PROJECT` already works — but `docker compose up` run by hand, without the launcher, no
  longer resolves to anything sensible.*
- **b.** `run.mjs` writes the tag into `docker-compose.yml`. *The file stays standalone and readable, but
  it is now generated and can be committed out of step with `.nvmrc`.*
- **c.** Leave the major-only `node:24-slim` tag and accept the drift from `.nvmrc`'s minor. *Free, and it
  gives up the part of #15 that motivated it.*

---

## D. spawned-windows-have-no-failsafe — Tier 3, Memory / context

**What the task is.** The interactive phases have a summarization failsafe: when a phase's exact
`prompt_eval_count` crosses `SUMMARIZATION_THRESHOLD_RATIO` (0.75) of the ceiling, `beforeModelCall`
compacts it. **Spawned windows do not have that.** They grow until Ollama silently drops the front of
the history — which for a spawned window means dropping its own contract.

**Why this section is the keystone.** E, F, H and I all touch a window's ceiling, and a ceiling is only
safe to lower once something bounds what fills it. Decisions here unblock those.

**The six growing arrays** — the task file named four:

| Window | Array | Rounds | Bound today |
|---|---|---|---|
| **Worker** | `this.messages`, persists across all 5 review rounds | `WORKER_MAX_ROUNDS = 24` **per round** — up to ~120 model calls in one window | **Eviction only** (`beforeModelCall` exists, from `075e2da`) |
| **Reviewer** | `this.messages` ([reviewer-runner.ts](src/core/session/reviewer-runner.ts)) | `REVIEWER_MAX_ROUNDS = 16` | none |
| **Retro** | `this.messages` ([retro-runner.ts](src/core/session/retro-runner.ts)) | `RETRO_MAX_ROUNDS = 16` | none |
| **Sub-agent** | `state.messages` ([subagents.ts](src/core/session/subagents.ts)) | `SUBAGENT_MAX_ROUNDS = 12` | none, **and no seam** |
| **Debate challenger** | grows across rounds | `MAX_DEBATE_ROUNDS = 5` | none |
| **Debate proponent** | grows across rounds | `MAX_DEBATE_ROUNDS = 5` | none |

**Two facts that shape the answers.**

- **`WorkerWindow.beforeModelCall` already exists** — what it lacks is summarization. It runs
  `evictStaleToolResults`, which **stubs older tool results in place** (the message stays so the
  assistant `tool_call` keeps its partner and the chat template still renders). It never touches anything
  earlier than the newest surviving half, and it **declines entirely** when acting would mean reaching
  into the head. A declined pass is the signal that the window is *head-heavy* — the growth is in the
  seed and the early turns, not in tool output — and eviction has nothing left to give.
- **`subagents.ts` has no seam at all.** `runTurns` pushes messages onto `state.messages` and calls
  `llm.chat` directly; it never goes through `processMessage`, so there is no `beforeModelCall` to hook.
  That is the most work of the six and the least evidence for it.

### ◻️ #22 — Which windows are in scope?

**Why this is a question.** The two debate windows were not in the task file's count, and they are a
different shape: they carry the uncapped `background` at index 1 (section E) and die after at most five
rounds.

- **a.** All six. *Cost: includes the sub-agent's missing seam and the debate pair, which section E is
  already about.*
- **b.** The four the file names (Worker, Reviewer, Retro, sub-agent); the debate pair belongs to task E.
  *Cost: leaves two unbounded windows outside this task, on the argument that capping `background` is
  what actually bounds them.*
- **c.** Only what the ceiling-lowering tasks need — Worker head-heavy + Reviewer + Retro. *Cost:
  smallest change that unblocks F and H; the sub-agent and debates stay unbounded.*

### ◻️ #23 — Does a spawned window summarize, or compact without inference?

**Today.** The interactive failsafe calls `oneShot('summarize')`. Measured cost of that call: **15.0 s on
the 14b, 38.4 s on the 32b.** `summarize` deliberately has **no** entry in `resolve-window-ctx.ts` —
it stays at the base ceiling, because its input is roughly half a full window and a smaller ceiling
would make Ollama drop the front of exactly what it is preserving.

**Why this is a question.** In an interactive phase you are sitting there and a pause is legible. Inside
an unattended `/run all` the same pause is dead time nobody sees, once per compaction, per window, per
task. The repo has never said whether that is acceptable in a batch.

- **a.** `oneShot('summarize')`, mirroring the interactive failsafe. *Faithful: the window keeps a real
  summary of what it did. Costs 15–38 s each time, inside a batch.*
- **b.** Non-inference compaction — drop the oldest exchange whole, no model call. *Free and instant.
  Loses the content outright rather than condensing it, and "drop the oldest" is what eviction already
  approximates more surgically.*
- **c.** Refuse to compact and terminate the window loudly — on the grounds that a Worker that has lost
  its head is not producing trustworthy work anyway. *Turns a silent corruption into a loud failure,
  which the constitution generally prefers. Costs the task.*

### ◻️ #24 — What does a spawned window keep verbatim, and where does the summary sit?

**Today.** Index `[0]` is the system prompt. Index `[1]` is the **seed** — that window's entire contract:

- **Worker:** the task definition + the spec slice + its branch name.
- **Reviewer:** the Worker's summary + the changed files + the last test run.
- **Retro:** the misunderstanding + your answer + the stashed diff of the failed attempt.

**Nothing in the repo says the seed is protected.** The interactive failsafe protects `[0]` and appends
its summary last, because an interactive phase's "contract" is the system prompt alone — there is no
seed message. A spawned window is the opposite shape.

- **a.** Protect `[0]`+`[1]`, append the summary last — as the interactive failsafe does with what it has.
- **b.** Protect `[0]` only. *A Worker that loses index 1 has lost the task it is implementing.*
- **c.** Protect `[0..1]` and splice the summary **where the collapsed turns were**, so chronology reads
  straight.

*Note: the task file's argument that putting the summary first makes compaction cheap is **false** — the
cached prefix dies at the first collapsed index either way. This is purely about what the model reads.*

### ◻️ #25 — What is the trigger?

**Today.** Two ratios, deliberately ordered so the cheap instrument goes first:
`EVICTION_THRESHOLD_RATIO` = **0.6** and `SUMMARIZATION_THRESHOLD_RATIO` = **0.75**. Eviction costs no
inference, so it gets a run before summarization is considered. Both are configurable in `.env` and both
are described in `config.ts` as starting points, not measured optima.

**Why this is a question.** No window has ever had both mechanisms. The Worker would be the first, and
the repo says nothing about how the two interact.

- **a.** Reuse 0.75 — summarization fires at the same fraction it does interactively, after eviction has
  had its go at 0.6. *No new number to justify.*
- **b.** A third ratio — *what value?* *Cost: a third tunable, and a third thing to explain in `.env`.*
- **c.** Fire only when an **eviction pass declined** — the head-heavy signal. *Elegant: no new number,
  and it fires exactly when the cheap instrument has proven it cannot help. Cost: couples two mechanisms
  the code currently keeps deliberately separate, and a decline is currently silent.*

### ◻️ #26 — The sub-agent

**Today.** `SUBAGENT_MAX_ROUNDS = 12`, `runTurns` never calls `processMessage`, and a sub-agent's peak
context has never been measured. It is seeded with `initial_context` + task only, and its read-tracker is
its own — a sub-agent's reads never unlock its master's writes.

**Why this is a question.** It needs the most work of the six (a seam has to be created, not hooked) and
has the least evidence that it needs any.

- **a.** Measure a 12-round sub-agent's peak first, decide with data. *One benchmark; delays the decision.*
- **b.** Give it the hook regardless. *Consistency; possibly building a failsafe for a window that cannot
  reach its ceiling in 12 rounds.*
- **c.** Declare `SUBAGENT_MAX_ROUNDS = 12` a sufficient bound and **record why in `subagents.ts`**. *Free,
  and honest as long as the reasoning is written down where the next reader finds it.*

### ◻️ #27 — What does a spawned compaction emit?

**Today.** Two event types exist. `summarization_fire` is written by `SessionOrchestrator` with **exact**
before/after `prompt_eval_count`s — deferred, because the "after" is not known until the next response
comes back. `eviction_fire` is written by a **spawned window** (the Worker) and carries how many tool
results were stubbed and the index it started from; it is flagged `incomplete` rather than filled in when
Ollama reports no count. `events-log.type.ts` calls the writer "Harness" rather than "orchestrator"
precisely because of that one row.

- **a.** Reuse `summarization_fire` with a phase field. *No new type; the phase field distinguishes
  interactive from spawned.*
- **b.** A new event type. *Clearer to query; one more thing in the union.*
- *And for a sub-agent: does the row carry `subagentId`, the way `subagent_spawn` does? Without it, two
  concurrent sub-agents' rows are indistinguishable.*

---

## E. cap-the-debate-background-parameter — Tier 3, Memory / context

**What the task is.** `debate`'s `background` parameter is **free text the model writes, with no bound of
any kind**. It is injected into two windows and re-read every round.

**Today, precisely.** `materialSection` ([run-debate.ts](src/core/session/run-debate.ts)) renders
`\n## Material\n\n<background>\n` and splices it into **both** opening seeds:
`openingObjectionRequest` (the challenger) and `openingDefenceRequest` (the proponent). So `background`
sits at index 1 of two separate growing windows and is re-evaluated on every one of up to five rounds.
It is deliberately **not** repeated to the third window (the digest) — that comment says a large
`background` replayed a third time "is exactly the num_ctx spend this loop exists to avoid", which is the
task's own argument turned on itself.

**Two constraints on any answer.**

- **There is no tokenizer in the repo**, so any cap is expressed in **characters**, not tokens.
- **Five places assert `background` is uncapped**, not two — including
  [resolve-window-ctx.ts](src/core/llm/resolve-window-ctx.ts), which names it as the reason both debate
  roles are excluded from the bounded 8 192 group. So even the cap-only half must edit that file's
  reasoning.

**The cap half is shippable alone** — two agents concluded that independently.

### ◻️ #28 — What is the cap, in characters?

Three defensible precedents already exist in the repo; the task file names only the first.

- **a. 12 000** — `REVIEW_DIFF_BUDGET` ([project-git.ts](src/core/session/project-git.ts)), the bound on a
  diff handed to a model. ≈3 080 tokens. *Most generous; the debaters keep nearly everything.*
- **b. 6 000** — `TRANSCRIPT_BUDGET` ([generate-context-title.ts](src/core/session/generate-context-title.ts)),
  the other model-facing budget, chosen specifically as a one-shot ceiling. *Chosen for the same shape of
  call the debaters are.*
- **c. 5 000** — `READ_FILE_CHAR_LIMIT` ([render-numbered-slice.ts](src/tools/render-numbered-slice.ts)).
  *The strongest argument of the three: `background` is most often file content that already arrived
  through `read_file`, which cut it at 5 000 — so anything past 5 000 came from somewhere else anyway.*
- **d.** A number you name.

*This choice largely decides whether the ceiling half is possible at all: the smaller the cap, the more
plausible it is to move both debate roles into the bounded 8 192 group.*

### ◻️ #29 — Truncate, or refuse the call?

**Today.** The repo splits on **authorship**, consistently: text the *orchestrator* read (a diff, a file,
a transcript) is truncated silently or with a marker, while the one over-limit **model-written** argument
— `ask_user`'s question list — is **refused** with an actionable message telling the model what to do
instead.

**Why this is a question.** `background` is model-written, so by that rule it should be refused — and a
refusal is something the model can actually comply with, unlike a truncation it cannot see.

- **a.** Truncate. *Never costs a turn; the model never learns to write less.*
- **b.** Refuse with a hint to shorten `background`. *Follows the authorship rule. Costs one wasted tool
  call whenever it fires, inside an unattended batch.*
- **c.** Truncate below one threshold, refuse above a second. *Handles "slightly over" and "wildly over"
  differently — two numbers to justify instead of one.*

### ◻️ #30 — If truncating: head-only or head+tail, and is the model told?

**Today.** `truncateHeadTail` exists and carries its own elision marker; `git_inspect` uses it for
`diff`/`show`. Every other bound in the repo announces itself in some form.

**Why this is a question.** Here the notice would tell the model that **its own input** was trimmed —
which no existing message does.

- **a.** Head-only, silent. · **b.** Head-only + a notice. · **c.** Head+tail via `truncateHeadTail`'s
  built-in marker. · **d.** Head+tail + an explicit notice line inside the Material section.

*Head+tail matters more here than usual: `background` pasted from a file often has the conclusion at the
end.*

### ◻️ #31 — Does the cap live in the tool or the loop?

**Today.** `debate.ts` validates `background` is a string and trims it, then hands a `DebateRequest` to
`runDebate`. `materialSection` inside `run-debate.ts` is what actually renders it into the two seeds.
There is exactly **one caller** today, so nothing in the repo decides this.

- **a.** `debate.ts` — bound it once at the entry gate, where the refusal message would live anyway.
- **b.** `run-debate.ts`'s `materialSection` — bound what is actually re-sent, and cover any future caller
  automatically. *But a refusal cannot originate there: by then the tool call has been accepted.*

### ◻️ #32 — Does a cap that fired get recorded?

**Today.** The events log gets one `debate` row per loop, carrying `debatePromptTokens` in its metadata —
the only durable record of what those throwaway calls cost. The transcript goes to the scrollback and the
windows die.

- **a.** Nothing extra. · **b.** A flag or dropped-character count on the existing row. · **c.** On the
  `metadata` beside `debatePromptTokens`. · **d.** On the summary line you read in the scrollback.

### ◻️ #33 — Do the five phase files learn the bound?

**Today.** All five phase files that hold `debate` push toward **more** material — the tool description
itself says "anything you leave out is a fact the debate cannot use". That instruction now runs against a
ceiling.

- **a.** Leave them; the tool description carries the budget. · **b.** Add the budget to the `background`
  parameter description in `debate.ts` only. · **c.** Amend all five phase files.

*Note the constitution: edits under `rules/` are never auto-committed, so (c) means a diff you review by
hand.*

### ◻️ #34 — Should the ceiling half be attempted in this task at all?

**Why this is a question.** You ruled that **proof discharges the ceiling gate per window** (*Already
answered* #2) — a measurement releases a window's ceiling without waiting for the failsafe to ship. But
the three roles already in the bounded 8 192 group all have an input with a **known hard maximum**. The
two debate roles hold a *growing* window: each round adds a turn.

- **a.** Ship the cap; re-file the ceiling with a measurement.
- **b.** Ship both if the measurement clears.
- **c.** Drop the ceiling half permanently — a growing window does not belong in a group whose defining
  property is "input has a known hard maximum", cap or no cap.

---

## F. tune-the-global-num-ctx-default — Tier 3, Memory / context

**What the task is.** `DEFAULT_NUM_CTX` is **16 384** ([config.ts](src/core/session/config.ts)), applied
to every window. The task asked whether that is the right number. **The benchmark is done** — results
below — and the number has still not been chosen.

**Why the number is hard to change.** Every phase context in SQLite is **stamped** with the `num_ctx` it
was written under (`insertContext`), and both `listContexts` and `resolveContextId`
([memory-db.ts](src/core/session/memory-db.ts)) filter on `num_ctx = ?` — strict equality. So changing
the env value **hides every existing context from `/resume`, in every project, silently**: nothing is
deleted, nothing is listed, and restoring the old value brings them all back.

### ✅ Benchmark complete — results

Every figure from Ollama's own response fields. Fixed 4 548-token prompt, `num_predict` 128, temp 0,
seed 42, KV prefix cache busted per call, A/B/A/B blocks, warm-up discarded.

**Residency — the task file's premise was wrong.**

| model | `num_ctx` | in VRAM | total | spilled |
|---|---|---|---|---|
| 14b | 12 288 | 10.69 GB | 11.61 GB | **0.92 GB** |
| 14b | 16 384 | 10.49 GB | 12.42 GB | 1.93 GB |
| 32b | 12 288 | 10.58 GB | 23.39 GB | 12.80 GB |
| 32b | 16 384 | 10.35 GB | 24.49 GB | 14.13 GB |

The 16 384/14b row reproduces the recorded table exactly. But **12 288 is not fully resident either** —
the residency cliff sits *below* 12 288. The choice is less-spill vs more-spill, never resident vs not.

**Generation throughput (median)**

| model | 12 288 | 16 384 | cost of 16 384 |
|---|---|---|---|
| 14b | **25.09 tok/s** | 17.79 tok/s | **−29.1 %** |
| 32b | 3.13 tok/s | 2.91 tok/s | −6.8 % |

Prefill is barely affected (−4.4 % on the 14b). The penalty is generation-side memory bandwidth.

**Window-fill sweep, 14b** — the penalty is roughly constant across fill, so it compounds with fill decay
rather than washing out:

| fill | 12 288 | 16 384 | penalty |
|---|---|---|---|
| 2 027 tok | 24.97 | 18.72 | −25.0 % |
| 6 186 tok | 23.05 | 16.28 | −29.4 % |
| 11 239 tok | 19.54 | 14.38 | −26.4 % |

**The decisive line: a 91 %-full 12 288 window (19.54 tok/s) generates faster than a nearly-empty 16 384
window (18.72 tok/s).**

Two further findings:

- **8 192 is now disproved a third way.** At 8 192 the *summarization* threshold (0.75 × 8 192 = 6 144)
  falls below Breakdown's 7 283-token fixed overhead, so both failsafes would fire on turn one. At 12 288
  both clear (eviction 7 373 > Worker 5 432; summarization 9 216 > Breakdown 7 283).
- **The ceiling-change runner rebuild is ~16–18 s on the 32b**, not the ~3.3 s recorded for the 14b
  (measured at ~4.3 s here). A bounded one-shot's down-and-back therefore costs **~33 s on a 32b** —
  which may make the whole 8 192 one-shot lane a net loss on large models. Bears directly on **#53**.

### ◻️ #68 — What is the number?

*This is the decision the benchmark existed to inform.*

On the 14b, 16 384 buys 4 096 tokens of ceiling for **29 % of generation speed**. The agent
pre-registered ">30 % *and* 12 288 fully resident" as its threshold for a strong recommendation; neither
half fired cleanly, so it declined to round the result into a verdict rather than dress a judgement call
as a finding. The trade, concretely:

| | 12 288 | 16 384 |
|---|---|---|
| Worker working room | 6 856 tok | 10 952 tok |
| Discovery working room | 5 160 tok | 9 256 tok |
| Generation (14b) | 25.1 tok/s | 17.8 tok/s |

("Working room" = the ceiling minus that phase's measured fixed overhead — what is actually left for the
conversation.)

- **a.** Move to 12 288 — buy 29 % speed, lose 4 096 tokens of room everywhere. *Also triggers #35.*
- **b.** Stay at 16 384 — keep the room, record the measured cost, close the file. *Nothing to migrate.*
- **c.** Split by model (see #37) — the data says one global number is wrong for one of the two.
- **d.** Measure further first — *what would settle it for you?*

### ◻️ #35 — Migration: which of the three?

**Why this exists.** If #68 moves the number, every context written under 16 384 vanishes from `/resume`.

- **a.** Accept the hide. *Free today, and honest — those histories really were built for a different
  window. Costs every context in every project.*
- **b.** A one-time `UPDATE contexts SET num_ctx`. *Everything stays reachable, but the column then
  asserts something false about what those turns actually ran under.*
- **c.** Relax the predicate from `num_ctx = ?` to `num_ctx <= ?`, plus a warning in `/resume`. *A context
  built for a **smaller** window replays safely into a larger one; the reverse does not. So this is the
  only change that is true in both directions — see #36.*

### ◻️ #36 — Should option (c) ship regardless of whether the number ever changes?

**Why this exists.** Strict equality **already** hides contexts that would replay perfectly safely into a
larger window — someone who raised `OLLAMA_NUM_CTX` at any point in the past has unreachable history
right now, for no reason. That looks like a standalone defect independent of #68.

- **a.** Yes — ship it as its own fix. · **b.** No — only if the number moves.

### ◻️ #37 — Per-model ceilings: now or deferred?

**The benchmark now argues for this** rather than leaving it open. 16 384 costs **29.1 %** on the 14b but
only **6.8 %** on the 32b — because the 32b is 12.8 GB offloaded at *either* ceiling, so the extra 1.33 GB
of KV cache is marginal. One global number is demonstrably wrong for one of the two models.

**Why it is not free.** It collides with `contexts.num_ctx`: a ceiling that follows `/models use` changes
**mid-session**, while a context is stamped **once at creation**. So per-model ceilings mean the stamping
design changes too.

- **a.** Defer; keep one global number, and **record which model it is right for**.
- **b.** In scope now, and the stamping design changes with it.

*(Incidental: the 32b runs at ~3 tok/s regardless of ceiling — roughly 8× slower than the 14b at 12 288.
Ceiling choice is not what makes it slow.)*

*(`OLLAMA_KV_CACHE_TYPE` was declined as a fourth benchmark arm. It is now **more** interesting than when
you declined it, since neither candidate ceiling turned out to be fully resident — a q8_0 KV cache could
halve the spill at 16 384 without giving up any room. Say if you want it filed as its own backlog item
rather than dropped.)*

---

## G. budget-ceilings-for-runs-and-batches — Tier 3, Execution loop

**What the task is.** Put a spend ceiling on a task and on a batch, so an unattended run cannot consume
the night on one wedged task.

**Every seam already exists** — this is blocked on decisions only. Two facts the task file got wrong:
**there is no `Σ` on the status line** (only a stale comment claiming one), and **there is no per-task
wall clock** either.

**It follows task A**, which invents the vocabulary this extends: A adds a way for the backlog to see
"this was tried and it failed", and G adds a *second* way for a task to end without a verdict. Answering
#39 before #2 means guessing at a vocabulary that does not exist yet.

**Today's four outcomes** ([batch.ts](src/core/session/batch.ts)): `passed`, `escalated` (five rounds
tried, none passed), `blocked` (the Reviewer raised a blocker), `cancelled` (you interrupted it). The
asymmetry that matters: **`cancelled` ends the batch; `escalated` lets it continue.**

### ◻️ #38 — Tokens, wall clock, or both?

**Today.** Token counts arrive from Ollama on every response and are already summed per phase. Nothing
anywhere times a task.

- **a.** Tokens only. *Reuses everything that exists. Blind to a task that is slow but not chatty.*
- **b.** Wall clock only. *Entirely new plumbing, but the only thing that catches a wedged-but-chatty run —
  or a 32b at 3 tok/s.*
- **c.** Both, as two independent ceilings. · **d.** Both, whichever trips first.

### ◻️ #39 — What does a crossed *task* ceiling produce?

**Why this is a question.** The task file says `escalated` — but `escalated` is a **judgement**: five
rounds were tried and none passed. `cancelled` exists precisely so that an *un-judged* ending is never
reported as one; `docs/phases.md` states that distinction explicitly. A budget stop is un-judged.

- **a.** Reuse `escalated` with a budget reason. *Weakens a distinction the docs make on purpose.*
- **b.** Reuse `cancelled`. *Honest about being un-judged — but see #40: it also **ends the batch** today.*
- **c.** A fifth outcome, e.g. `over_budget`. *Correct and clear; every switch over outcomes grows a case,
  and this interacts with whatever #2 adds.*

### ◻️ #40 — Does a crossed task ceiling stop the batch?

**Why this is a question.** The task file says keep going. But `cancelled` **ends** the batch and
`escalated` **continues** it — so answering #39 with (b) silently reverses the file's stated intent
without anyone deciding to.

- **a.** Keep going, as the file says. · **b.** End the batch.

### ◻️ #41 — Are the two ceilings independent, and what does a batch ceiling mean for `/run <one-id>`?

**Today.** A single task goes through `runOneTask` and **never enters `runBatch` at all** — different code
path, no batch summary, no batch pre-flight.

- **a.** The batch ceiling applies only to true batches; a single task is bounded by the task ceiling alone.
- **b.** The batch ceiling also wraps `runSingle`. *Then "batch" is a misnomer for what it bounds.*
- **c.** A batch ceiling **implies** a task ceiling when the task one is unset. *Convenient; two numbers
  where you set one.*

### ◻️ #42 — Where do the numbers live?

**Today.** `/run` parses **exactly one** argument (`next` | `all` | a task id). A second argument means
changing the parser, the Tab completer, the usage string, and the docs.

- **a.** `.env` only. *Fits how every other tunable works; no parser change.*
- **b.** `.env` plus a per-invocation override. *Most flexible; the full parser cost.*
- **c.** `/run` argument only. *No persistent default — you have to remember it every night.*

### ◻️ #43 — What does "no ceiling" mean?

- **a.** Unset = unlimited — today's behaviour, no surprise on upgrade.
- **b.** A shipped default that starts bounding runs the moment this lands — *what value?* *A default that
  is too low silently truncates work someone expected to finish.*

### ◻️ #44 — What happens when the sum is unknown?

**Today.** Ollama can omit a token count, and the code already treats a missing metric as something to
surface rather than paper over (`eviction_fire` is flagged `incomplete` rather than filled in). For a
budget sum, a single null **poisons the total** rather than coercing to zero — so the ceiling cannot be
evaluated at all. The constitution says surface it; it does not say which way to fail.

- **a.** Fail-closed — refuse the next round, end the task saying it cannot be budget-checked.
- **b.** Fail-open — warn loudly, keep going, so a missing metric never costs a night's work.
- **c.** Fail-closed for the batch, fail-open for the task.

### ◻️ #45 — Check granularity

**Today.** A Worker window gets `WORKER_MAX_ROUNDS = 24` model calls **per review round**. Checking only
at round boundaries therefore means up to 24 calls between checks, and a task can overshoot its ceiling
substantially before anyone notices.

- **a.** Round boundaries only — simplest, no new hooks.
- **b.** Hook `beforeModelCall` and check before every call. *The seam exists (the Worker already uses it
  for eviction), and it bounds the overshoot to one call.*

### ◻️ #46 — What do you see live, if anything?

**Today.** The status line shows `Phase: <Name> | Ctx: N%` and `Model: … | Project: …`. There is **no `Σ`**,
and Worker/Reviewer tokens never reach `activePhaseTokenTotal` — so the `Ctx: N%` you see during a run is
about the idle interactive phase, not the window doing the work.

- **a.** Nothing live. · **b.** Task spend. · **c.** Batch spend. · **d.** Both — *and against what
  denominator when no ceiling is set?* (A bare `Σ 48,231` with nothing to compare it to is a number, not
  information.)

*This overlaps task J — see #64 for who owns the field.*

### ◻️ #47 — Small: file layout

**Today.** [config.ts](src/core/session/config.ts) holds four functions — `resolveNumCtx`, `resolveRatio`,
`resolveTimeoutMs` and `loadConfig` — against the constitution's one-function-per-file rule. It is an
existing, deliberate exception for env resolution.

- **a.** Add the budget resolver there, for local consistency with the other env resolvers.
- **b.** Split it into its own file, per the rule.

---

## H. surface-matching-standards — Tier 3, Model behavior

**What the task is.** Nine reusable standards live in [rules/standards/](rules/standards/) and the model
only sees them if it thinks to call `search_rules`. The task proposes hinting the relevant one into a
window's seed so the Worker does not have to guess that a standard exists.

**The measurement the task defers to already exists.** The catalog is **530 exact tokens** with
descriptions, and **~50 tokens for the nine slugs alone**. The slugs are unusually self-describing:
`testing-discipline`, `error-handling`, `naming-conventions`, `commit-hygiene`, `documentation`,
`language-idioms`, `clean-architecture`, `hexagonal-ddd-manifesto`, `simplified-technical-english`.

**"Seed time" is not one moment.** The Worker is seeded once per task, but the **Reviewer is a fresh
window every round** — up to 5 per task. A per-seed cost is therefore up to 6 calls per task, not 2.

**Today.** `search_rules` ([src/tools/search-rules.ts](src/tools/search-rules.ts)) loads the catalog and
hands it to `ctx.oneShot(messages, 'search-rules')` — a bounded role at 8 192, so it pays a runner rebuild.
Separately, `worker.md` and `reviewer.md` **already order an unconditional
`load_rule("simplified-technical-english")`**.

### ◻️ #48 — Hint, resident names-only, or resident names + descriptions?

*This is the fork the measurement opens. If this goes to (b) or (c), the rest of this section changes
wholesale — most of #49–#56 only exist because a hint is a separate model call.*

- **a.** One hint per seed, as the file proposes. *Zero resident cost, one extra call per seed, one name
  delivered.*
- **b.** Resident **names only** (~50 tokens/turn, ~0.3 % of 16 384), with `load_rule` called directly and
  no matching step. *No extra call ever, and the slugs are descriptive enough to choose from. `search_rules`
  becomes optional rather than the only door.*
- **c.** Resident **names + descriptions** (~530 tokens/turn, against a Worker fixed overhead already at
  5 432) and `search_rules` **retired**. *The model always knows exactly what exists; costs ~3 % of the
  window on every single turn.*
- **d.** Hint *and* resident names.

### ◻️ #49 — How many rounds does the Reviewer get hinted?

Only meaningful under #48 (a) or (d).

- **a.** Round 1's Reviewer only. · **b.** Every Reviewer window — up to 5 extra calls per task.
- **c.** No Reviewer at all.

### ◻️ #50 — What text is matched, for each phase?

- **Worker:** **a.** `task.title` + `task.body` · **b.** those plus the spec slice.
- **Reviewer:** **c.** the same task text — identical hint, identical cost, arguably a wasted call ·
  **d.** the Worker's summary + changed files, which is what it is *actually* judging and would produce a
  **different** hint.

### ◻️ #51 — Top-1 or top-N, and what happens on no match?

- **a.** Omit the line entirely — the seed reads exactly as it does today.
- **b.** State "no standard matched — call `search_rules` if you need one".
- *And on a transport failure or a missing prompt file: skip silently the way `generateContextTitle` does,
  or fail the task? The first keeps a batch alive through a hiccup; the second never hides a broken
  install.*

### ◻️ #52 — Should the hint's *body* ever be injected?

**Why this is a question.** The task file says name-only, so the model stays the one who decides what to
load. But `worker.md` and `reviewer.md` already inject one standard unconditionally — so "never inject" is
**not** the repo's current position, and the file's reasoning is arguing against something the repo
already does.

- **a.** Name only. · **b.** Name only, **but suppress the hint when it duplicates the already-hardcoded
  standard**. · **c.** Inject the body when the match is confident.

### ◻️ #53 — Which `num_ctx` ceiling?

**Today.** A **bounded** role (8 192) costs a runner rebuild going down and coming back; a **base-ceiling**
role costs nothing. The `num_ctx` benchmark revised that cost sharply upward: the rebuild is **~4.3 s on
the 14b but ~16–18 s on the 32b**, so a bounded one-shot's down-and-back is **~33 s on a large model**,
not the ~6.6 s previously recorded.

- **a.** Base — no table entry, no rebuild. *The hint is cheap on every model.*
- **b.** Bounded 8 192 — residency, but ~33 s per hint on a 32b, fired up to 6 times per task.
- **c.** Reuse the existing `search-rules` role rather than adding one. *No new `CallRole` member; inherits
  whatever that role's ceiling becomes.*
- *Separately: **should the newly-measured 32b rebuild cost be filed as its own backlog item** against the
  bounded one-shot lane as a whole? At ~33 s per call, 8 192 may be a net loss on large models for
  `context-title` and `commit-message` too — which is a question about
  [resolve-window-ctx.ts](src/core/llm/resolve-window-ctx.ts), well beyond this task.*

### ◻️ #54 — Escalate an ignored hint to the Reviewer?

**Today.** Nothing tracks which `load_rule` calls a window made. That tracking does not exist and would
have to be built.

- **a.** No escalation. · **b.** Tell the Reviewer which standard was hinted, without saying whether the
  Worker loaded it. · **c.** Tell it the Worker never loaded it — *a way to fail a task on a technicality.*

### ◻️ #55 — Worker and Reviewer only, or every phase with `search_rules`?

**Today.** Discovery, Design, Breakdown and Retro all hold `search_rules` and all have a seed. The task
file names only the two execution phases and gives no reason.

- **a.** Worker + Reviewer. · **b.** Every phase.

### ◻️ #56 — Is the hint surfaced to you?

**Today.** A hint is not a tool call, so it gets no `→`/`←` scrollback row. Two precedents:
`context_title` writes an events-log row and prints nothing; `eviction_fire` prints one line **because
you are about to wait through a prompt re-evaluation** and an unexplained pause in an unattended run is
exactly what the tool-call record exists to prevent.

- **a.** Events-log row only (the `context_title` precedent).
- **b.** A row plus one printed line, since you wait through the call (the `eviction_fire` precedent) —
  and under #53(b) that wait is up to 33 s.
- **c.** Neither.

---

## I. small-model-lane-for-one-shots — Tier 3, Memory / context

**What the task is.** Six one-shot roles exist. Could the cheap ones run on a *small* model instead of the
session model, so they cost less and evict nothing?

**Today.** `OneShotRole` ([call-role.type.ts](src/core/llm/call-role.type.ts)) is closed at six:
`context-title`, `summarize`, `search-rules`, `commit-message`, `debate-turn`, `debate-digest`. Three of
them (`context-title`, `search-rules`, `commit-message`) already sit at the bounded 8 192 ceiling; the
other three sit at base.

**The recorded cost was misread.** "13–22 s" is **not** the marginal cost of a model hop: the three roles
that would move **already pay ~6.6 s of runner rebuild** for their ceiling change. The true marginal cost
is **hop − 6.6 s**. And per section F, that 6.6 s is itself ~33 s on a 32b — which cuts the other way and
makes the lane *more* attractive on large models.

**Status: the benchmark is authorized but held on #1** — pulling the small models changes the boot pick.
The deferral currently holds.

### ◻️ #57 — Is the CPU-pinned arm (`options.num_gpu: 0`) in scope?

**Why this exists.** It is the only design where the big model is **never evicted from VRAM at all** — the
small model runs entirely on CPU, so there is no hop, in either direction. It was never considered in the
record, and it is a per-call Ollama option this repo has never used.

*I assumed **yes**, since you chose to run the benchmark whole — say if not.*

- **a.** Include it. · **b.** Exclude it. · **c.** Its own backlog file.

### ◻️ #58 — What result would you accept as decisive?

A product decision the repo does not state — and without it the benchmark produces numbers nobody can act
on.

- **a.** Strictly faster than today. · **b.** No worse than today, plus a residency gain. ·
  **c.** Latency-agnostic if quality holds.

### ◻️ #59 — Do the numbers get written down even if they confirm the deferral?

**Why this is a question.** `README.md` already records the first measurement, which suggests yes. But a
backlog file is meant to be **deleted when work ships**, and a confirmed deferral ships nothing — so the
file would sit open forever holding a finding.

- **a.** Record in the task file and leave it open. · **b.** Record and **close** the file with the reason.
- **c.** Record in [docs/open-questions.md](docs/open-questions.md), where the question is already listed
  as *Throwaway-context model*.

### ◻️ #60 — If the benchmark favours the lane, does it get built in this pass?

Not asked by the agent, but it follows. Building it means: a **second** model resolution point, a second
`activeModel`-shaped setting, a second `/models use` form, and token counts summed across **two
tokenizers**.

- **a.** Build it. · **b.** Record the finding and re-file the build as its own task.

---

## J. in-turn-progress-reporting — Tier 3, Terminal UX

**What the task is.** During a `/run`, you cannot see where the batch is. Reporter-side only — **zero
model tokens.**

**Today.** `updateStatus` ([src/interface/repl.ts](src/interface/repl.ts)) paints two pinned lines:

```
Phase: <Name> | Ctx: N%
Model: <model> | Project: <project>
```

`Ctx` is the *active interactive phase's* exact cumulative tokens over `numCtx` — so during a Worker round
it is a frozen number about a window nobody is watching. **Neither line is clamped to width today** — you
ruled that fix folds in here (*Already answered* #9).

**The scrollback is already far richer than the task file claims** — a per-round record lands there
already. What is missing is **live aggregate position**, not a record.

Proposed rows:

```
Worker · round 3/5 | task 3/12 T-042 add pagination to /notes | Ctx: 71% | Σ 48,231
Model: qwen2.5-coder:14b | Project: notes-api
```

### ◻️ #61 — Does the live window replace `Phase:`, append to it, or get its own field?

**Why this matters.** `Phase:` means the *interactive* phase, which is still selected and still holds a
context while a Worker runs. Overwriting it hides a true fact to show another one.

- **a.** `Worker · round 3/5` **replaces** `Phase: Design` for the duration — shortest, and the row is
  width-constrained.
- **b.** `Phase: Design → Worker` — the more honest: both are true at once.
- **c.** `Phase: Design | Run: Worker` — explicit, and the widest.

### ◻️ #62 — Field priority when the row will not fit?

Proposed drop order, right to left: `Σ` → task title → batch position → task id → round, with
Model/Project dropped last.

- **a.** As proposed. · **b.** A different order — *which?*

*(The clamp itself is settled — it folds in here. This is only about what survives the clamp.)*

### ◻️ #63 — What does `Ctx: N%` mean while a Worker round runs?

- **a.** Leave it as the interactive phase's fill. *Consistent, and useless during a run.*
- **b.** Show the **live window's** exact fill over its own ceiling. *What you actually want to know.*
- **c.** Show both.
- *If (b): **before the window's first turn there is no exact figure**, and the constitution forbids
  inventing one (no `?%`, no length-based estimate). Blank, or omit the field until the first response
  arrives?*

### ◻️ #64 — Is live cumulative spend in scope here, or does it belong to task G?

**Why this is a question.** It needs either a new reporter callback or an exposed `tokens` getter — a
**seam signature**, and whichever task adds it owns the shape both tasks then use.

- **a.** Here. · **b.** Task G owns it. · **c.** Neither; no live spend field at all.

### ◻️ #65 — Should anything new be printed to the scrollback?

- **a.** Nothing new — the per-round record is already there.
- **b.** A closing line per round, e.g. `⏱ round 3/5 · 14m22s · 12 tool calls · 48,231 tokens`.
- *This also decides whether a **redirected, non-TTY run** gets any progress at all: pinned status lines
  do not exist without a TTY, so the scrollback is the only channel a piped log has.*

### ◻️ #66 — Where does the live window name come from?

- **a.** `ctx.activePhase` at the existing hook. *Free, and it also covers Retro, debates and sub-agents —
  but it requires depth-stacking `status-activity` (which today has a flat
  `turnStarted`/`toolStarted`/`toolEnded` shape) and widens a core file's UI coupling.*
- **b.** Two new reporter methods. *Explicit and scoped to `/run` — but Retro and debates stay invisible,
  since neither goes through the batch reporter.*

### ◻️ #67 — What shows while a sub-agent runs, and should `Subagents: N` finally exist?

**Today.** `orchestrator.ts` carries a comment describing "the status line's `Subagents: N`, omitted when
zero" — and **no code paints it**. The field has been claimed in a comment and never built.

- **a.** Nothing — a sub-agent is just another tool call on the activity line.
- **b.** A `[sub:01JQ]` marker in the window field, matching the scrollback convention already in use.
- **c.** The `Subagents: N` field as originally commented. *Which means either building it or deleting the
  comment; leaving both as they are is the one option that should not survive.*

---

## Already answered — the nine meta-decisions

These settled before the numbered pass and are not up for re-answering unless you say so.

1. **GPU budget** — both benchmarks authorized; `OLLAMA_KV_CACHE_TYPE` declined as a fourth arm.
2. **Ceiling gate** — *proof suffices, per window*: a measurement releases a window's ceiling without
   waiting for the failsafe to ship. (Bears on #34.)
3. **Node floor** — keep `>=24`; find a different justification for it. (Section C.)
4. **Adjacent defects** — fold in when it is the same fix; anything needing separate design gets its own
   backlog file.
5. **num_ctx benchmark model** — both 14b and 32b.
6. **num_ctx candidates** — 12 288 and 16 384; 8 192 dropped as already disproved.
7. **Small models to pull** — two, compared: `qwen2.5-coder:1.5b` and a 3b. (Held on #1.)
8. *(A#5)* The `blocked`-status stash defect folds into task A.
9. *(J#62)* The missing status-row clamp folds into task J.

---

## What is blocking what

- **#2** blocks the whole of task A, and A blocks G's vocabulary (#39).
- **#1** blocks task I's benchmark, and task F's #68 is answerable without it.
- **#69** blocks the `/models use` half of task B; the boot half is decided and written up.
- **#73** blocks task C's check; the `.nvmrc`-as-source-of-truth half is decided and written up.
- **#22–#27** (section D) gate the ceiling work in E, F, H and I — a ceiling is only safe to lower once
  something bounds what fills the window.
- **#48** reshapes most of section H depending on which way it goes.
