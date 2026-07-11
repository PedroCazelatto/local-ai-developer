> **Status:** ✅ Completed (2026-07-11)

# 01 — Implement→test→review→fix loop

**Version:** V3
**Depends on:** V1/10 (Worker phase + execution trigger), V2/01 (Reviewer phase), V2/02 (review integration), V2/03 (auto-commit on accept)
**Blocks:** V3/05 (unattended batch execution drives this loop per task)

## Why

V2 stops at "Worker writes → Reviewer judges → the user drives any fix." V3 closes the inner loop so a human isn't needed on every round. CLAUDE.md "Execution phases" specifies the cycle `implement → test → review → fix, (loop, max 5 rounds)` per task, and that **the same Worker window does the fixes** — its history accumulates every prior attempt plus the Reviewer's feedback so it converges instead of starting blind. After 5 rounds without a pass, the loop stops and escalates to the user. This task wires that controller; the `raise_blocker` short-circuit is V3/02 and the unattended batch wrapper is V3/05.

## Behavior

For a single task, the orchestrator runs a bounded loop. The Worker window is created **once** and reused across all rounds; the Reviewer gets a **fresh** window each round.

```
runTaskLoop(task) -> TaskLoopResult

round 1..MAX_ROUNDS (MAX_ROUNDS = 5):
  - Worker turn (persistent window):
      round 1  -> system = rules/phases/worker.md, user = task definition
      round n>1 -> append the previous Reviewer feedback as the next user turn
                   (no reset — full prior history is replayed)
      Worker writes/updates failing tests, implements, runs tests via run_in_project.
  - Reviewer turn (fresh window each round):
      system = rules/phases/reviewer.md
      user   = { task definition, Worker's latest output / diff, test results }
      returns the V2/01 structured verdict, OR calls raise_blocker (V3/02).
  - if verdict.status == "pass":
      auto-commit via V2/03; return { outcome: "passed", rounds, tokens }
  - if Reviewer called raise_blocker (V3/02):
      return { outcome: "blocked", question, rounds, tokens }   # loop halts immediately
  - else (verdict.status == "fail"):
      carry verdict.feedback into the next Worker turn; continue

after MAX_ROUNDS with no pass:
  return { outcome: "escalated", rounds: 5, lastFeedback, tokens }
```

### Result shape

```ts
type TaskLoopOutcome = "passed" | "escalated" | "blocked";

interface TaskLoopResult {
  taskId: string;
  outcome: TaskLoopOutcome;
  rounds: number;                 // rounds actually run (1..5)
  commit?: string;                // present when outcome === "passed"
  question?: string;              // present when outcome === "blocked" (from raise_blocker)
  lastFeedback?: string;          // present when outcome === "escalated"
  tokens: { prompt: number; completion: number };  // EXACT, summed across all turns
}
```

- **`passed`** — Reviewer returned `pass`; the work is committed (V2/03); loop ends.
- **`escalated`** — 5 rounds elapsed with no pass; the orchestrator surfaces the task, the round count, and the last Reviewer feedback to the user. Nothing is committed.
- **`blocked`** — Reviewer called `raise_blocker` (V3/02); the loop ends mid-round and the question goes to the user.

### Worker window persistence (the load-bearing rule)

- The Worker window is allocated **once per task** and lives for the whole loop. CLAUDE.md memory model: *"the Worker, whose history persists across the fix loop … and is then discarded when the task closes."*
- On a `fail`, the Reviewer's `feedback` is appended to the Worker's existing history as the next user turn. The Worker is **never** reset between rounds — that is what lets it converge.
- The Reviewer is the opposite: a **fresh, empty** window every round, discarded after it returns. It must not accumulate state across rounds (a stale verdict must never leak forward).
- When the loop ends (any outcome), the Worker window is discarded — except its token totals, which are already captured exactly.

## Files

- `src/core/session/task-loop.ts` — new; the `runTaskLoop` controller (round loop, `MAX_ROUNDS = 5`, outcome assembly). The choke point everything else in V3 hangs off.
- `src/phases/worker.ts` — touched; expose creating one persistent Worker window and appending a feedback turn to it (do not re-instantiate per round).
- `src/phases/reviewer.ts` — touched; expose spawning a fresh Reviewer window per round and returning the V2/01 verdict (or the V3/02 blocker signal).
- `src/core/session/orchestrator.ts` — touched; the execution trigger (V1/10) calls `runTaskLoop` for the chosen task(s) instead of running a single Worker pass.
- `src/core/ui/*` — touched; render round progress (`round 2/5`), the verdict per round, and the escalation message with the last feedback.

## Notes / pitfalls

- **`MAX_ROUNDS = 5` is a hard cap, not a target.** Count a round as one Worker turn + one Reviewer turn. Round 1 is the first implement; rounds 2–5 are fixes. Off-by-one here means 4 or 6 rounds — assert exactly 5.
- **Do not reset the Worker window between rounds.** This is the single most important behavior in the task. If you find yourself rebuilding the Worker's messages array each round, you've broken the design.
- **Reviewer must be fresh each round** — no cross-phase and no cross-round leakage. Per CLAUDE.md, phase histories are isolated; the Reviewer never sees the Worker's internal turns, only the structured output handed to it.
- **Tokens are exact.** Sum `prompt_eval_count` / `eval_count` from every Worker and Reviewer turn across all rounds (CLAUDE.md: tokens always exact, never estimated). If any turn fails to return a count, surface that in the result rather than guessing.
- **`escalated` commits nothing.** Only a `pass` triggers the V2/03 auto-commit. Half-finished code from 5 failed rounds is left in the working tree for the user to inspect, uncommitted.
- **`blocked` halts immediately** — V3/02 owns the short-circuit; this controller just needs to detect the blocker signal coming back from the Reviewer turn and return without running a fix round.
- No parallelism: one task's loop fully completes (or halts) before the next begins (V3/05).

## Acceptance

- In a live `run start` session, trigger one task whose definition is clear: the Worker writes failing tests, implements, the Reviewer passes on round 1, and the work is auto-committed — `TaskLoopResult.outcome === "passed"`, `rounds === 1`, `commit` set.
- Trigger a task the Worker gets wrong once: the Reviewer fails round 1 with feedback, the **same** Worker window receives that feedback as its next turn (verifiable: its message history contains round-1 code + the feedback), fixes it, the Reviewer passes round 2 — `rounds === 2`.
- Force 5 consecutive fails (e.g. an impossible acceptance criterion): the loop stops at round 5, returns `outcome === "escalated"` with `lastFeedback`, commits nothing, and the UI surfaces the escalation.
- `TaskLoopResult.tokens` equals the exact sum of every turn's Ollama-reported counts across all rounds (spot-check against the audit log).
- The Worker window from one task is not reused by the next task's loop (fresh window per task).
