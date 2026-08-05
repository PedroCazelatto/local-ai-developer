# Give the Worker a plan that survives its rounds

**Category:** Execution loop

## Decide whether this is worth window before building it

This is a habit carried over from a harness with room to spare, and it is the item on the comparison list
with the least confidence behind it. At 16k the plan competes with the code the Worker is reading, and it may
cost more window than it saves rounds.

**The decision is not "plan or no plan" — it is which half to build.** The proposal bundles two things that
are separable, and they have very different risk:

- **A plan in the model's window** — the expensive half, and the one that may not pay for itself.
- **A plan the user can see** — [in-turn-progress-reporting.md](in-turn-progress-reporting.md), which costs
  zero tokens because it never enters a prompt.

Build the reporting half first; it is free. Then decide on this one with evidence.

## If it goes ahead

The Worker has the task body and its own prose history, and nothing structured that survives five rounds. A
small `task_plan` the Worker writes once and then **replaces** — one message in the window, never appended to
— would help it converge.

The replace-not-append rule is what keeps this from becoming another
[evict-stale-tool-results.md](evict-stale-tool-results.md) problem. Note that rewriting a message mid-history
has a cost that file documents in detail: it invalidates the KV-cache prefix from that point on, so a plan
replaced every round is a prefix re-evaluated every round. Placing it **late** in the history — after the
seed, not before the tool results — is what makes the rewrite cheap.

**Measure it.** Compare rounds-to-pass with and without, on the same tasks, before keeping it. This is the one
item on the list where the recommending harness's own bias is most likely to be the whole reason it is here.

## Why the comparison suggested it

Claude Code keeps an explicit checklist through multi-step work, and it does two jobs at once: the user sees
progress, and the thread of intent survives a long turn where individual tool results have scrolled out of
relevance. The second job is the one that would help a Worker on round 4 that has forgotten what round 1 was
trying to do.

But the harness it comes from has orders of magnitude more window, and a checklist there is rounding error.
Here it is a real fraction of what the Worker has to think with. The honest position is that this is a
hypothesis, not a recommendation.

## Open decisions

- **Whether the Reviewer sees the plan.** It would make feedback far more targeted, and it also lets a
  confidently-wrong Worker frame its own review.
- **Whether the plan survives into the next attempt of an escalated task.** The stash is deliberately never
  reused (see [record-attempted-tasks.md](record-attempted-tasks.md)); a carried-over plan is the same
  question in a different shape.
- **What it costs, exactly.** Cap the plan's size in tokens, not in items — five items of prose is unbounded.
