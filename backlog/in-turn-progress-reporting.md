# Show where a long task has got to

**Category:** Terminal UX

During execution the user sees `round 3/5` from `TaskLoopReporter`, a spinner, and an elapsed timer. On a 3060
each round is a Worker turn plus a fresh Reviewer window, so `round 3/5` is the only progress signal across
what can be half an hour, and it says nothing about *what* is happening or whether it is going well.

The status line has room and the data already exists. Candidates, all of which the orchestrator already knows
without asking the model anything:

- **Which window is live** — `Worker` or `Reviewer`, not just the round number. The status line's `Phase:` field
  shows the interactive phase; a spawned execution window is invisible there.
- **The task being worked**, by id and short title, so a batch is legible without scrolling back to where it
  announced itself.
- **Batch position** — `task 3/12` alongside `round 3/5`. Two nested counters, both known.
- **Cumulative spend for the task**, which is the live half of
  [budget-ceilings-for-runs-and-batches.md](budget-ceilings-for-runs-and-batches.md) and is exact already.
- **The last verdict reason**, one truncated line. "Round 2 failed: tests not run" tells you far more about
  whether to intervene than `round 3/5` does.

## Why this is separable from a plan in the window

The comparison suggested an in-window `task_plan` ([task-plan-inside-a-task.md](task-plan-inside-a-task.md)) and
justified it partly on the user seeing progress. Those are two different features and only one of them is
expensive.

Everything on the list above is **reporter-side**: it never enters a prompt, so it costs zero tokens and cannot
compete with the code the Worker is reading. That makes it the half to build first and unconditionally — and it
also removes one of the arguments for the in-window plan, leaving that decision to rest on whether it helps the
*model*, which is the question that actually needs measuring.

## Constraints this must respect

- The pinned rows are the only thing that may repaint, and they are already exactly sized: three rows idle, five
  with the input fence up (`status-bar.ts`). Adding a field means composing it into one of the two existing
  status lines, not taking a fourth row — and both lines already carry four fields between them at full width.
- Token figures are **exact** or absent. A null propagates as null; nothing here may show an estimate.
- Anything printed into the scrollback instead of the status rows is permanent and must be worth keeping. A
  per-round summary line probably is; a per-tool-call one is
  [show-tool-calls-in-the-scrollback.md](show-tool-calls-in-the-scrollback.md)'s job.

## Decisions (answered — OPEN-QUESTIONS.md meta J, #61–#67)

**The scope grew.** The file was filed as *status-line only* and explicitly argued the scrollback was
already rich enough. Meta J overturns that half:

> False: during a `/run`, the terminal must be printing whatever is being run. We will also edit the
> status line below the input to have this info, like what you proposed.

So this task now has two halves — the pinned rows **and** the scrollback.

### The pinned rows

- **`Phase: Design → Worker`** (#61b). The live window is **appended, not substituted**: the
  interactive phase is still selected and still holds a context while a Worker runs, and overwriting it
  hides a true fact to show another one. The answer names a second reason the shorter option (a) would
  have cost: *"this way, the input is also connected to the running interaction and I can send more
  messages to the model if I see it diverging from the goal."* See #91 below — that is a different
  feature wearing this one's clothes.
- **The live window's name is the phase plus the task id** (#66) — `Worker T-042`. Not
  `ctx.activePhase` at the existing hook (a) and not two new reporter methods (b), but what the field
  reads: the phase, identified by which task it is on.
- **`Ctx: N%` follows the live window** (#63b) — its exact fill over **its own** ceiling, switching
  from Worker to Reviewer as the round hands over (#46). **Before the window's first response it reads
  `0%`**, and that is exact rather than invented: zero tokens of a 16 384 ceiling *is* 0 %. No `?%`, no
  blank, no omitted field.
- **`Ctx` counts only what is sent to the model** (#64) — the figure Ollama already returns
  (`prompt_eval_count`), not a locally accumulated notion of history. This also settles the seam
  question by implication: the field is the live window's own reported count, so **this task owns it**
  and [budget-ceilings-for-runs-and-batches.md](budget-ceilings-for-runs-and-batches.md) consumes it.
- **The clamp folds in here** (*already answered* #9). Neither status line is width-clamped today.
- **The drop order is not decided yet** (#62) — see *What #62 needs from this file* below.

### The scrollback

- **Both: live per-round output and a closing line per round** (#65). What the round is *doing* is
  printed as it happens; each round then closes with a summary line of the shape
  `⏱ round 3/5 · 14m22s · 12 tool calls · 48,231 tokens`. This is also what gives a **redirected,
  non-TTY run** any progress at all — pinned rows do not exist without a TTY, so the scrollback is the
  only channel a piped log has.
- **One interleaved stream, coloured per phase, with a transition line on every swap** (#65). The
  phases' *histories* stay independent — that is the memory model and does not change — but their
  *output* is printed together in one chronological scrollback, so an overnight run reads as one
  narrative. Colour is per phase, and per the constitution the palette lives in `theme.ts` alone; the
  model never chooses a colour.

### Sub-agents

- **One sub-agent at a time, and `Subagents: N` is therefore not built** (#67): *"as we are targeting
  precision and accuracy, maybe we dont need more than one subagent, as we wont have VRAM for more than
  one parallel subagent."* `orchestrator.ts:175` carries a comment describing a `Subagents: N` field
  that no code paints; under a hard limit of one, the count is never interesting. **The comment is
  deleted** — #67c's "leaving both as they are is the one option that should not survive" still holds,
  and deleting is now the right half of it. A running sub-agent shows as the `[sub:01JQ]` marker the
  scrollback already uses (#67b).

## What #62 needs from this file

#62 asked for a drop order and the answer was *"lets make a list of everything that is usefull at the
status line and then I will draw it for you."* The complete candidate list, with what each costs and
where it comes from — **nothing here needs a model call; every field is already known to the
orchestrator**:

| field | example | source | notes |
|---|---|---|---|
| interactive phase | `Design` | `ctx.activePhase` | true whether or not a run is live |
| live window | `→ Worker T-042` | task loop reporter (#61b, #66) | absent when no run is in flight |
| round | `round 3/5` | `MAX_ROUNDS` + loop | Worker/Reviewer pair per round |
| batch position | `task 3/12` | `BatchPosition` | absent for `/run <one-id>` |
| task title | `add pagination to /notes` | backlog | the widest field, and the most droppable |
| context fill | `Ctx: 71%` | live window's `prompt_eval_count` / its ceiling (#63b, #64) | `0%` before the first response |
| elapsed | `14m22s` | wall clock | new plumbing; also what task G's ceiling measures |
| task budget | `12m/30m` | task G | only when a ceiling is set (#43a: unset = unlimited) |
| model | `qwen2.5-coder:14b` | `orch.model` | `no model` when none is active |
| project | `notes-api` | config | fixed for the session's whole lifetime |
| sub-agent | `[sub:01JQ]` | `listSubagents()` | at most one (#67) |
| blockers | `⚠ 2 blocked` | backlog | not previously proposed; `/blockers` already computes it |

Two constraints on any drawing: the rows are **three idle, five with the input fence up**
(`status-bar.ts`), and adding a field means composing it into one of the two existing lines rather than
taking a fourth row.

## Steering is authorized, and sequenced behind this task (#91a)

#61's second reason — *"the input is also connected to the running interaction and I can send more
messages to the model if I see it diverging from the goal"* — is
[steer-a-running-turn.md](steer-a-running-turn.md), which has moved out of *Blocked on a decision* and
into Tier 3. It builds **after** this task: the `Phase: Design → Worker T-042` label is what makes
steering legible, because knowing which window is live is the difference between correcting the Worker
and interrupting the Reviewer.

This task ships without it. The field is a label; the steering is a separate feature that consumes it.

## `/batch` is removed (#92)

The scrollback becomes the record. With #65 printing what each round is doing and closing each round
with its own line, `/batch` re-prints a worse copy of something the user already has — and two records
of one run is the overlap this file has flagged since it was filed.

**This is a deletion of shipped work**, so it is worth being explicit about what goes and what stays:

- **Goes:** the `/batch [n]` command, its registry entry, its Tab completion, and its section in
  `docs/cli.md` (a governance-doc edit — review-gated).
- **Stays:** `runBatch` keeps writing `.orchestrator/batches/` (#98a), *"for audit purposes."* The
  summary is a durable artifact whether or not a command prints it — and a non-TTY run's scrollback is
  a pipe that may go nowhere, so the file is sometimes the only copy. It also remains what
  [record-attempted-tasks.md](record-attempted-tasks.md) calls "the only durable record of this was
  tried and it failed".

  This does knowingly recreate the shape that justified filing
  [move-the-logs-into-sqlite-tables.md](move-the-logs-into-sqlite-tables.md) — *a record written to a
  file no command surfaces* — which is an argument for folding the batch summaries into that task's
  store rather than for not writing them.
- **`/audit` stays** (#102a): *"audit reaches older messages."* The duplication argument that removed
  `/batch` does not reach it, and the reason is the one thing the scrollback cannot do — it is bounded
  by the terminal's buffer, while the log is not. After an overnight batch, `/audit` is the only way
  back to the first hour. It is also the single choke point that records the runner-level refusals
  which never appear as ordinary tool-call rows.

  So the pair splits cleanly: `/batch` printed something the scrollback already holds in full, and
  `/audit` prints something it no longer holds.

`backlog/README.md`'s shipped Tier-1 entry for the inspection commands describes `/batch` as one of
five; correcting it is part of the commit that removes it.
