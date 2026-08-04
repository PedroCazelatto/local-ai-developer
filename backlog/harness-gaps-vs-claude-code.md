# Close the harness gaps found by comparing against Claude Code

**Category:** Harness capability

A comparison of this orchestrator against Claude Code — the agent harness used to build it — looking
only for differences that are **implementable here**, under this project's real constraints: one local
model, one RTX 3060, a hard `num_ctx`, strictly sequential windows, no cloud spend.

The framing matters, because the largest difference is not on this list. Claude Code drives a frontier
model with a very large window; this drives a 14–32b quant in 16k. Nothing below closes that gap. What
the list is about is the principle this repo already half-encodes: **a weaker model needs a tighter
harness, not a looser one.** Several designs here already follow it — the Reviewer as sole committer,
`verdictGitConflict` refusing a verdict the repo disagrees with, exact token counts that are never
estimated. The items below are the places where this harness is currently *looser* than the one built
for the stronger model, which is backwards.

Each section is independently shippable. Ship them in any order and trim this file as they land; delete
it when nothing is left.

## Discount this list where it is self-referential

This document was produced by asking one agent harness to compare a second one against itself. That is
a structurally suspect exercise and the list should be read with it in mind: the output of "compare X
to me" is always going to be a list of ways X should be more like me.

The parts to trust hardest are the ones that follow from physics rather than taste. §1 is right because
16k is 16k, and an unbounded `read_file` is indefensible on any harness at any model size. §2b is right
because three phases genuinely cannot enumerate a subdirectory today.

The two to trust least are flagged in place, and both are cases where the recommending harness has a
very large context window and this one does not:

- **§8** (an in-task plan) helps an agent with room to spare. A Worker at 16k may simply lose window to
  it for no return. It is a hypothesis, not a recommendation.
- **§4** (mid-turn steering) is arguably against the grain of the product. The stated value is "start a
  batch and walk away"; steering serves someone sitting and watching, which is the mode this project
  deprioritized on purpose. Cancelling is clearly right. Steering may not be.

More generally: every section below carries an outside reading of this project's intent. The open
decisions that are marked are the ones that were visible from the code and the docs. The ones that were
not visible are exactly the ones this list will have gotten wrong — so treat the whole file as a draft
to correct, not a plan to execute.

## Suggested order

By value per unit of work, not by section number:

1. Bound `read_file` (§1a) — small change, largest single effect.
2. Evict stale tool results (§1b, §1c) — medium change, comparable effect.
3. Context lines in `search_in_files`, recursive `list_files` (§2) — small, large.
4. A small-model lane for the one-shots (§6) — small, large, and already an open question.
5. Read-before-edit (§3) — small, medium.

Everything after that is worthwhile but not urgent.

## 1. Context economics

The binding constraint on this project is `num_ctx`. Claude Code spends a great deal of harness effort
on not wasting context; this orchestrator spends almost none *at the message-array level*. That is the
single biggest recoverable difference.

The `debate` tool (shipped in `a9c0e49`) is the right principle already applied once: "the caller pays
for the digest, not the argument." Everything in this section is that same principle applied to the
things a phase reads rather than the things it argues about.

### 1a. `read_file` is unbounded

`src/tools/read-file.ts` returns the entire decoded file. There is no cap, no line range, and no
truncation.

This is inconsistent with every other output path in the repo — `execute_command` and `run_in_project`
truncate head+tail, `search_in_files` stops at 200 matches, `git_inspect` is bounded by
`REVIEW_DIFF_BUDGET` — and it is the tool the model reaches for most. One 900-line file is the whole
Worker window.

What it needs:

- `offset` and `limit` parameters, and a default line cap when neither is given.
- **Line-numbered output.** This is the quiet half of the change: line numbers make `edit_file`
  targeting easier for a weak model, make its failure messages diagnosable, and let a phase ask for a
  range on the second read instead of the whole file again.
- A truncation notice that states what was withheld and how to ask for it, so a cut file never looks
  like a short one.

### 1b. Tool results live in the window forever

Every tool result stays verbatim in the phase's message array until the summarization failsafe fires at
`SUMMARIZATION_THRESHOLD_RATIO` and rewrites the history wholesale. There is nothing between "keep it
all" and "summarize everything."

An eviction policy is the missing middle: keep the last N tool results in full, and replace older ones
with a one-line stub naming the call and what it returned (`read_file src/foo.ts → 340 lines,
superseded`). It is more surgical than summarization, it costs no inference at all, and it is
reversible in the sense that the durable record still holds everything — the eviction hides turns from
the live view exactly the way the memory model already describes for summaries.

It matters most for the Worker, whose window persists across all five rounds by design. That design is
load-bearing and must not be traded away to save context — evicting stale *tool output* is precisely
how to keep it affordable.

### 1c. Re-reading a file pays for it twice

Nothing dedupes reads. A file read in round 1 and again in round 3 occupies the window twice, and the
first copy may be stale on top of that. Evicting superseded reads of the same path is the cheapest
possible version of §1b and could ship on its own.

## 2. Search and navigation are thinner than the phases need

### 2a. `search_in_files` is literal-substring only

Case-sensitive, no regex, no context lines, no paths-only mode (`src/tools/search-in-files.ts`).

The one to add first is **context lines**. With a few lines either side of a match, a weak model can
often answer its question straight from the search result and never call `read_file` at all — which
feeds directly back into §1. Case-insensitive search and a paths-only mode are cheap additions on the
same pass; regex is optional and carries a denial-of-service edge worth thinking about before adding.

### 2b. `list_files` can only see the project root

`src/tools/list-files.ts` takes no parameters and lists the project root, non-recursively. There is no
way to list `src/core/`.

Combined with the deliberate absence of a shell in the planning phases, this means **Discovery, Design
and Breakdown cannot enumerate a subdirectory at all.** The rationale recorded in `phase-tool-names.ts`
says `read_file` / `list_files` / `search_in_files` "already cover every inspection a spec or a backlog
needs" — they do not, and that gap is currently documented as a policy choice rather than the hole it
is.

Fix: an optional `path` parameter and an optional depth, with the same `ctx.resolve` scoping every other
file tool uses. Update the rationale comment in the same change so it stops asserting coverage the
tools do not have.

### 2c. There is no glob-by-path tool

Nothing answers "which files match `**/*.test.ts`?" — the model has to walk directories or grep for
content it hopes is unique to those files. In Claude Code this is one of the most-used tools, because
it is how you learn what exists without reading anything.

## 3. Read-before-edit and staleness

`edit_file` already has the good half of this: `old_string` must match exactly once, or nothing changes
(`src/tools/edit-file.ts`). That is the same rule Claude Code enforces and it is right.

What is missing is the other half. The tool will edit a file the model has never read, and it has no
idea whether the file changed since the model last saw it. For a model that is more often
confidently-wrong than self-aware — the stated reason the Reviewer is the sole gatekeeper — "look
before you write" is a cheap, mechanical guard against an edit reasoned from a hallucinated file.

What it needs: per-window tracking of which paths were read and their mtime at read time; `edit_file`
refuses with a recoverable message when the path was never read, or when it changed since. The refusal
text should say which case it is and what to do about it.

## 4. Steering a turn that is already running

Partly covered by [cancel-an-in-flight-turn.md](cancel-an-in-flight-turn.md), which should be built
first — this is the step past it.

Claude Code can be *redirected* mid-turn: a message arrives, it is read, the work adapts, and the turn
survives. Here, a message typed during a turn is queued and runs only once the turn has finished
(`message-queue.ts`). Cancelling is the blunt version of the same need; injecting the message at the
next tool-call boundary is the precise one, and the turn loop already has that seam — it is the point
between dispatching a tool call and starting the next turn.

Worth doing only after cancel exists, since cancel is the safety net that makes steering optional
rather than the only way out.

**Low confidence — see the caveat at the top.** This may be the wrong feature for this product. An
unattended batch has nobody watching to steer it, and the queue already handles the attended case
adequately. Decide whether it is wanted at all before building it.

## 5. Long-running commands block the loop

`run_in_project` blocks with a 120-second default, and the container is killed at the cap. A real
`npm install` or a full test suite exceeds that routinely. The model can raise `timeout_s`, but the
window still sits idle waiting for it.

Backgrounding a command and polling it would let a Worker start a slow suite and keep reading code
while it runs.

## Open decision — this one blocks the section

`docs/product.md` lists **no parallelism** as a non-goal. The stated reasoning is about VRAM and
concurrent model windows, which does not obviously cover a shell command running in a container while
one window thinks. But it may be intended to cover both, and that is not something to assume.

**Decide before building anything here.** If the non-goal covers shell commands too, delete this
section and record the reasoning in `docs/product.md` so the question does not get re-opened.

## 6. A small-model lane for the throwaway one-shots

`oneShot` runs against the session model. So a 32b model is loaded to write a 60-character context
title, a commit message, a `search_rules` match, and every summarization.

The `debate` loop makes this materially more expensive than it was: a five-round debate is roughly a
dozen one-shot calls — challenger, proponent, and the digest — all on the session model, and it is
meant to be used routinely before an expensive decision.

`docs/open-questions.md` already lists "Throwaway-context model" as undecided. The recommendation from
the comparison is to **split it**: a 1–3b model handles titling, commit messages, rule matching and
summarization adequately, and on a 3060 the VRAM and latency saving per session is large.

Sub-decisions if it goes ahead:

- Whether the debate windows count as throwaway (cheap) or as reasoning that deserves the session model
  — the digest is cheap, the argument itself is the part with actual judgement in it.
- What happens when the small model is not installed. Falling back to the session model silently is
  wrong for the same reason a hard-coded default model is wrong; it should be a visible state.

## 7. Standards do not surface themselves

`search_rules` → `load_rule` is good design and should not change: progressive disclosure, catalog held
in a throwaway context, main window never sees the catalog.

The difference is *who initiates*. Claude Code's equivalent is matched against descriptions by the
harness and surfaced automatically; here the model must think to search, and a small model routinely
will not. The standards then exist but are never read, which looks identical to not having them.

Cheap fix that preserves the design: at Worker and Reviewer seed time, run one throwaway match of the
task text against the catalog and inject the top standard's **name** — not its body — as a hint the
phase can act on. It costs one small call and a few tokens, and it keeps the model as the one that
decides to load.

## 8. No plan structure inside a task

Claude Code keeps an explicit checklist through multi-step work: the user sees progress, and the thread
survives a long turn. The Worker here has the task body and its own prose history, and nothing
structured that survives five rounds.

A small `task_plan` the Worker writes once and then **replaces** — one message in the window, never
appended to — would help it converge, and would give `TaskLoopReporter` something better to show per
round than `round 3/5`. The replace-not-append rule is what keeps this from becoming another §1b
problem.

**Low confidence — see the caveat at the top.** This is a habit carried over from a harness with room
to spare. At 16k the plan competes with the code the Worker is reading, and it may cost more window
than it saves rounds. If it is tried, measure it: compare rounds-to-pass with and without, on the same
tasks, before keeping it.

## 9. Sub-agent results are unstructured prose

`ask_subagent` returns free text into the parent's window, so the parent has to re-read and interpret
it. The machinery for the better version already exists twice over: `submit_verdict` and `submit_retro`
are phase-scoped tools that capture a typed terminal result, and `debate` now returns a four-field
digest.

Generalizing that to sub-agents — a required response shape declared at spawn — makes their answers
parseable instead of prose, and bounds what a rambling sub-agent can cost its parent.

## 10. Escalation has no memory

Not a parity gap — this is a defect in the execution loop, found during the same pass and recorded here
rather than in its own file. Split it out if that reads better.

`TASK_STATUSES` is `pending | in_progress | done | blocked` (`src/core/session/types.ts`). There is no
terminal-failure state, and nothing anywhere records that a task was attempted.

So a task that burns all five rounds without a pass is set back to **`pending`**
(`run-task-loop.ts`, both the MAX_ROUNDS exit and the error paths), at which point it is
indistinguishable from a task nobody has ever touched. `resolveSelector('all')` takes everything that
is not `done`, so the next `/run all` picks it up and spends another five rounds on it — with a fresh
Worker that starts blind, since the stash is deliberately never reused.

Blocked tasks do not have this problem: they stay `blocked` until `/answer`, which is exactly the right
shape. It is only escalation that forgets.

The reason this is worse than it first looks: the escalation *is* recorded, in the batch summary under
`.orchestrator/batches/`. But nothing reads that back — that is the `/batch` item in
[inspection-commands.md](inspection-commands.md). So the only durable record of "this was tried and it
failed" sits in a file the tool cannot show, while the backlog file that actually drives scheduling
says `pending`. Two `/run all` invocations overnight can spend the second half of the night re-failing
the first half's tasks.

The shape of a fix is a distinct status plus an attempt count in the task's frontmatter, so `/run all`
skips it by default while `/run <id>` still retries deliberately.

## Open decisions — settle these before writing code

- **Whether the status vocabulary grows, or the attempt count alone carries it.** A new status is
  clearer to read in a task file; a count is less invasive to everything that switches on status.
- **What re-running a failed task means.** Retry from scratch (today's behavior), or refuse without an
  explicit override.
- **Where the count is written, and by whom.** The Reviewer owns `mark_task_done` and is the only
  execution actor that commits, so a counter written by the loop is a new writer of task files.
- **Whether a `/run all` that skips previously-failed tasks is the default** or an opt-in flag. The
  unattended-batch use case argues for skipping by default; the "I fixed the spec, try again" case
  argues the other way.

## The docs are the only verification layer

Context for whoever picks up [test-the-invariant-functions.md](test-the-invariant-functions.md), and
the strongest argument for it — one that file does not currently make.

The governance layer here is roughly 2,500 lines against 15,000 lines of code. That ratio is unusually
high and it is mostly earned: it is why this repo can be assessed quickly by someone who has never seen
it, and the two pieces of drift that were found were both in the places the currency rule does *not*
cover — `README.md`, which is exempted by a working rule, and the comments pointing at
`complete-line.ts`, which are code rather than docs.

The thing worth naming: with no tests, the docs are carrying **both** jobs. They are the specification
and they are the verification. That is why `docs/sandboxing.md` asserting "every file it edits happens
inside a container" is worse than an ordinary stale sentence — with tests that claim would be a failing
assertion, and without them it is prose that reads as true.

So tests would not add a verification layer. They would **relieve** one that is currently overloaded,
and let the docs go back to describing intent instead of also standing in for proof. If the
constitution amendment is a hard no, that is a legitimate call — but the doc-currency rule is then
carrying more weight than it was designed for, and that trade should be made knowingly rather than by
default.

## What must not be traded away

Recorded here because several items above touch these paths, and they are the things this harness does
*better* than the one it is being compared to:

- **Per-phase tool allowlists as data**, fail-loud on an unknown name, with the prompt's `# Your Tools`
  block generated from the very array sent to Ollama. Any new tool must be added to the arrays that
  should hold it — and only those.
- **`verdictGitConflict`** — the model's verdict is refused when the repo disagrees. Nothing added here
  may give a phase a way around it.
- **Exact token counts**, with a null propagated as null rather than coerced to zero. Eviction and
  budgeting both touch token accounting; neither may introduce an estimate.
- **The Retro loop**, and the rule that a `rules/` edit is never auto-committed.
- **The audit log**, written from the single dispatch choke point. New tools log through it like every
  other tool; none writes its own row.
- **The Worker's persistent window across the fix loop.** §1b exists to make it affordable, not to
  shorten it.
