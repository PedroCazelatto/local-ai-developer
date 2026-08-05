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

## Open decisions

- **What gets dropped at narrow widths.** The status lines already truncate; adding fields makes the priority
  order matter, and it has never been stated. Phase and model are presumably last to go.
- **Whether the execution windows take over the `Phase:` field or add to it.** Showing `Phase: Worker` while the
  interactive phase is still Design is either exactly right or actively misleading, depending on how the user
  reads that field.
- **Whether a per-round line also lands in the scrollback.** The status rows are live and vanish; a batch that
  ran overnight leaves nothing behind unless something was printed. This overlaps with `/batch` in
  [inspection-commands.md](inspection-commands.md) — decide which one is the record.
