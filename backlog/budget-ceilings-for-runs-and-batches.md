# Budget ceilings for a task and a batch

**Category:** Execution loop

Cost is reported exactly and only afterwards. Nothing bounds it while it runs. `MAX_ROUNDS` is 5, each
round is a Worker turn plus a fresh Reviewer window, and the only early exit is "the Worker produced no
file changes". So an unattended batch can spend hours on task 3 of 12 and you find out in the morning.

**What it needs, as the decisions below settled it.** A **per-task wall-clock ceiling**: crossing it
ends the loop as a new `over_budget` outcome — not `escalated`, which asserts a judgement no Reviewer
made — the task keeps its stash, its dependents are skipped, and every independent task in the batch
still runs. A **per-batch ceiling**: crossing it stops the batch cleanly and persists the partial
summary, which `runBatch` already knows how to do for an infra fault. The budget reason carried into
the batch summary buckets, so the morning-after report distinguishes "the Reviewer never passed it"
from "we stopped paying for it". And the live half surfaced on the status line, which
[in-turn-progress-reporting.md](in-turn-progress-reporting.md) owns (#46, #64).

**Two premises this file was filed on are wrong.** There is **no `Σ` on the status line** — only a
stale comment claiming one — and there is **no per-task wall clock** either, so the timing half is
entirely new plumbing rather than a comparison against something that already exists. The exact token
counts *do* exist (`runTaskLoop` sums every Worker and Reviewer turn, `runBatch` sums every task), but
#38b puts them out of scope for the ceiling itself.

Constitution note, for whatever still consumes the counts: the comparison is against the **exact**
summed counts, never an estimate. A task whose counts came back incomplete (a null poisoning the sum)
cannot be budget-checked — surface that rather than treating an unknown as under-budget.

## Decisions (answered — OPEN-QUESTIONS.md #38–#47)

- **Wall clock only** (#38b). No token ceiling ships. Everything below is timing plumbing, which does
  not exist anywhere in the repo today — nothing times a task. **The reasoning behind this answer does
  not hold, and it is worth re-checking before building:** see #86 below.
- **A crossed task ceiling produces a fifth outcome, `over_budget`** (#39c). Not `escalated`, which is a
  *judgement* (five rounds tried, none passed); not `cancelled`, which ends the batch. A budget stop is
  un-judged and the vocabulary has to say so. This is the second consumer of the same idea as
  [record-attempted-tasks.md](record-attempted-tasks.md)'s `failed` status — the two ship a shared
  vocabulary for "ended without a verdict", one in `TaskStatus` and one in the batch outcomes.
- **The batch continues, minus the tasks that needed the stopped one** (#40b, as stated). Not "end the
  batch" and not "keep going regardless": the tasks that **depend on** the over-budget task end with
  it, every independent task still runs.
- **The two ceilings are independent, and a single `/run <id>` is bounded by the task ceiling alone**
  (#41a). `runOneTask` never enters `runBatch`, and a "batch ceiling" that wrapped one task would be a
  misnomer for what it bounds.
- **`.env` only** (#42a). No `/run` argument, so the parser, the Tab completer and the usage string are
  untouched.
- **Unset means unlimited** (#43a) — today's behaviour, no surprise on upgrade, and no shipped default
  that silently truncates work someone expected to finish.
- **Fail open, loudly** (#44b). A metric the daemon failed to report never costs a night's work; it
  raises a high alarm instead. Note this is now a **wall-clock** budget (#38b), so the failure mode
  #44 was asked about — a null `prompt_eval_count` poisoning a sum — cannot arise for the ceiling
  itself. The alarm still belongs to whatever *does* consume the counts.
- **Checked at round boundaries only** (#45a). Accepted cost: `WORKER_MAX_ROUNDS` is 24 model calls per
  review round, so a task can overshoot by up to a full round before the check sees it. No new hook.
- **Live display follows the window that is actually running** (#46). While the Worker runs you see the
  Worker's usage; when the round hands over, the display switches to the Reviewer's. This is task J's
  #63b answered from the other side — one field, one owner, and
  [in-turn-progress-reporting.md](in-turn-progress-reporting.md) builds it.
- **One function per file** (#47b). `config.ts`'s four-function exception ends: `resolveNumCtx`,
  `resolveRatio`, `resolveTimeoutMs`, `loadConfig` and the new budget resolver each move to their own
  file, and **`config.ts` becomes a re-export that assembles them into the config object**. That is
  wider than this task and is why it has its own file:
  [split-config-into-one-function-per-file.md](split-config-into-one-function-per-file.md).

## #40 is almost free, and the reason is worth knowing before building it

The dependency-aware half of #40 needs **no new graph work**. `runBatch` already reloads the backlog on
every iteration — *"a prior task's commit changes what's runnable now"* — and `taskSkipReason` already
returns **`unmet-deps`** for a task whose `depends_on` entries are not all `done`
(`backlog.ts:186`, `batch.ts:88`).

So an `over_budget` task that is left **not `done`** causes every dependent to be skipped with an
accurate reason, automatically, as the batch walks on. What has to be built is only the negative: an
`over_budget` outcome must **not** `break` the loop the way `cancelled` does at `batch.ts:126`.

## Still open

- **#86 — #38's premise is false, and it is the reason the token half was dropped.** The answer reads
  *"lets use only time as the summarization will never let the tokens trigger to trip."* Summarization
  bounds **one prompt's size**, so no single window exceeds `num_ctx`. It does not bound a task's
  **cumulative** spend, which is what a budget ceiling sums: `runTaskLoop` adds every Worker and
  Reviewer turn across up to 5 rounds × 24 calls, monotonically, and summarization *adds* calls rather
  than removing them. A token ceiling would therefore trip, and readily. Wall clock is defensible on
  its own merits — it is the only thing that catches a wedged call, and the only unit that answers "it
  must be done by morning" — so the answer may well stand; but it should stand on that reason and not
  on this one. See [OPEN-QUESTIONS.md](../OPEN-QUESTIONS.md) #86.
- **#87 — what does the wall clock measure?** With tokens out of scope, the ceiling has no definition
  yet: elapsed time including the user's own idle time at an `ask_user` prompt, or model time only?
  An overnight batch is unattended so the two coincide, but `/run <one-id>` attended is exactly where
  they diverge, and a ceiling that counts thinking time will fire on a user who walked away from a
  question. See [OPEN-QUESTIONS.md](../OPEN-QUESTIONS.md) #87.
