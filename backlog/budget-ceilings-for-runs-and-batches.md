# Budget ceilings for a task and a batch

**Category:** Execution loop

Cost is reported exactly and only afterwards. Nothing bounds it while it runs. `MAX_ROUNDS` is 5, each
round is a Worker turn plus a fresh Reviewer window, and the only early exit is "the Worker produced no
file changes". So an unattended batch can spend hours on task 3 of 12 and you find out in the morning.

The tokens are already there and already exact — `runTaskLoop` sums every Worker and Reviewer turn and
`runBatch` sums every task. What is missing is a ceiling to compare them against and a decision to make
when one is crossed.

What it needs:

- A **per-task** ceiling (tokens, wall clock, or both). Crossing it ends the loop as an `escalated`
  outcome with a reason that says it was the budget, not a failed review — the task keeps its stash and
  the batch keeps going, exactly like any other escalation.
- A **per-batch** ceiling. Crossing it stops the batch cleanly and persists the partial summary, which
  `runBatch` already knows how to do for an infra fault.
- Both ceilings surfaced live rather than only at the end — a spend field next to the existing `Σ` on
  the status line, so an attended run shows where it is going.
- The budget reason carried into the batch summary buckets, so the morning-after report distinguishes
  "the Reviewer never passed it" from "we stopped paying for it".

Constitution note: the comparison is against the **exact** summed counts, never an estimate. A task
whose counts came back incomplete (a null poisoning the sum) cannot be budget-checked — surface that
rather than treating an unknown as under-budget.

## Open decisions

- **Tokens, wall clock, or both.** Tokens are the honest measure of work; wall clock is what actually
  matters for "it must be done by morning" and is the only one that catches a wedged call.
- **Where the numbers live.** `.env` alongside `OLLAMA_NUM_CTX` and `SUMMARIZATION_THRESHOLD_RATIO`, or
  an argument to `/run` so a batch can be given a different ceiling than a single task.
- **What "no ceiling" means** — whether unset is unlimited (today's behavior, no surprise) or whether
  there is a default.
