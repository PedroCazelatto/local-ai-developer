# Backlog checklist

An index of the 24 open task files in this folder, in the order worth shipping, plus the 2 framing notes
that are not tasks.

**This file is not a task and is not deleted when work ships.** It is upkeep: when a task's file is deleted
in the commit that lands it (see [docs/repo-layout.md](../docs/repo-layout.md)), tick and strike its line
here in the same commit. The task files remain the source of truth — every line below is a pointer, never a
summary to act from.

---

## Tier 1 — ship first

Cheapest work per unit of value, and the two gaps both framing notes call physics rather than taste.

- [x] ~~**Cancel an in-flight turn**~~ — *Terminal UX.* Shipped: Ctrl+C stops the turn and a second press
      still quits, both Ollama paths carry an `AbortSignal`, `OLLAMA_TIMEOUT_MS` is a stall window, a
      cancelled exchange branches off the live history, and `/stop` · `/stop round` wind a batch down.
- [ ] **[Bound `read_file`, and number its lines](bound-read-file-output.md)** — *Memory / context.* Small
      change, largest single effect; the one unbounded output path in a repo where everything else
      truncates. Line numbers are the half that stops a second read.
- [ ] **[Show what a tool call actually did](show-tool-calls-in-the-scrollback.md)** — *Terminal UX.* The
      largest UX gap after cancel and the cheapest to close — `args` is already in hand one line above the
      print, and every result already passes the audit log's choke point. A record, not a confirmation
      prompt.
- [ ] **[Let `list_files` see a subdirectory](list-files-subdirectories.md)** — *Harness capability.*
      Discovery, Design and Breakdown cannot enumerate a folder at all today, and
      `phase-tool-names.ts` documents that hole as a policy choice. Correct that comment in the same change.
- [ ] **[Context lines and a cheaper default for `search_in_files`](search-in-files-context-lines.md)** —
      *Harness capability.* Same effort as the bounded read and the same goal: answer from the search result
      instead of paying for the file.
- [ ] **[Inspection commands](inspection-commands.md)** — *In-app commands.* The walk-away loop has no
      come-back half; `/tasks`, `/blockers`, `/inbox`, `/batch`, `/audit` are pure reads over files already
      on disk. Ships before [record-attempted-tasks.md](record-attempted-tasks.md) so that task's escalation
      record becomes readable.

## Tier 2 — defects and misleading code

Not parity gaps. Each is a place where the repo currently says something that is not true.

- [ ] **[Stop a failed task looking untouched](record-attempted-tasks.md)** — *Execution loop.* An escalated
      task reverts to `pending`, so a second overnight `/run all` re-fails the first one's tasks. Pairs with
      [budget-ceilings-for-runs-and-batches.md](budget-ceilings-for-runs-and-batches.md) — both need an
      outcome the backlog can see.
- [ ] **[Make `edit_file` refuse an unread file](read-before-edit-guard.md)** — *Harness capability.* Build
      the read-tracking here, then the `rules/phases/` prompts can tell the Worker to stop verifying its own
      edits — which is what removes one of the two duplicates
      [evict-stale-tool-results.md](evict-stale-tool-results.md) exists to clean up after.
- [ ] **[Close the symlink hole in path scoping](resolve-symlinks-in-path-scoping.md)** — *Sandboxing /
      security.* `docs/sandboxing.md` asserts a guarantee the lexical `resolveInProject` check does not
      provide. Touches the same `ctx.resolve` as `list_files` above; settle the two together. The doc edit is
      review-gated — hand the diff over, never auto-commit.
- [ ] **[Minor cleanups](minor-cleanups.md)** — *Repo hygiene.* Three unrelated small defects in one commit:
      the shell interpolation in `run.mjs`, the `.gitignore` exception that is not implemented, and the dead
      link in [switch-phase-tool.md](switch-phase-tool.md).
- [ ] **[Resolve the dead Tab completion](resolve-dead-tab-completion.md)** — *In-app commands.* Five sites
      reason carefully about a `complete-line.ts` that does not exist. **Needs your call:** wire it back or
      delete the hook. Either is fine; leaving it is not.

## Tier 3 — context economy and throughput

Where the window is also a clock. Two of these want measurement before design.

- [ ] **[Evict stale tool results](evict-stale-tool-results.md)** — *Memory / context.* **Verify the
      KV-cache premise first** with a throwaway two-call script; rewriting history can cost more wall clock
      than the tokens it reclaims. The dedupe-superseded-reads subset needs no policy and ships on its own.
- [ ] **[Give each window its own `num_ctx`](per-window-num-ctx.md)** — *Memory / context.* One global
      ceiling serves the Worker and the 60-character context titler alike.
- [ ] **[Run the one-shots on a small model](small-model-lane-for-one-shots.md)** — *Memory / context.*
      Sibling of the item above — same resolution point, best built together. Already open in
      `docs/open-questions.md`, and the `debate` loop made it more expensive than it was.
- [ ] **[Hint the matching standard](surface-matching-standards.md)** — *Model behavior.* One throwaway
      match at seed time so standards that exist are actually read. A natural first user of the small lane.
- [ ] **[Budget ceilings for a task and a batch](budget-ceilings-for-runs-and-batches.md)** — *Execution
      loop.* The exact counts already exist; what is missing is a ceiling and what to do at it. Compare
      against summed exact counts, never an estimate.
- [ ] **[Show where a long task has got to](in-turn-progress-reporting.md)** — *Terminal UX.*
      Reporter-side only, so it costs zero tokens and cannot compete with the code the Worker is reading.
      Build it before deciding [task-plan-inside-a-task.md](task-plan-inside-a-task.md) — it removes one of
      that task's two justifications.

## Tier 4 — worthwhile, not urgent

- [ ] **[Add a glob-by-path tool](glob-files-by-path.md)** — *Harness capability.* Paths are the cheapest
      unit of knowledge about a codebase. Decide alongside `list_files`: new tool, or a mode of that one.
- [ ] **[Structured sub-agent results](structured-subagent-results.md)** — *Harness capability.* The
      isolation already exists; the bound does not. `submit_verdict` and `debate` are the working precedent.
- [ ] **[Give the model a `switch_phase` tool](switch-phase-tool.md)** — *Model behavior.* Its prerequisite
      shipped in `3cc8b7b`. Read the implementation hazard before starting — the switch must not split a
      `tool_calls` / `tool` pair across two histories.
- [ ] **[Smooth the new-project path](smooth-new-project-onboarding.md)** — *Onboarding.* Scaffold → exit →
      restart → commit by hand → plan. The scaffold-commit fix is the small half and removes the refusal for
      the common case.

## Blocked on a decision — nothing to build until you answer

These are questions for the user, not defaults for an implementer to pick.

- [ ] **[Background long-running commands](background-long-running-commands.md)** — does the **no
      parallelism** non-goal in `docs/product.md` cover a shell command in a container, or only concurrent
      model windows? If it covers both, delete the file and record why.
- [ ] **[Test the pure invariant functions](test-the-invariant-functions.md)** — requires amending the
      *Testing* section of `constitution.md`, and if so, deciding the scope. **Do not amend it as part of
      the task.**
- [ ] **[A plan inside a task](task-plan-inside-a-task.md)** — is an in-window plan worth window at 16k?
      Lowest-confidence item on the harness list. Build the reporting half first, then decide with evidence.
- [ ] **[Steer a running turn](steer-a-running-turn.md)** — build it at all? It serves the attended mode the
      product deprioritized on purpose. Cancel first regardless.

## Framing notes — not tasks

Neither is deleted when work ships; each goes when the last file it indexes is gone.

- **[harness-gaps-vs-claude-code.md](harness-gaps-vs-claude-code.md)** — the harness comparison: how far to
  trust it, and **what must not be traded away** while closing the gaps (per-phase tool allowlists as data,
  `verdictGitConflict`, exact token counts, the Retro loop, the audit log's single choke point, the Worker's
  persistent window). Read that section before starting anything in Tier 1–3.
- **[ux-gaps-vs-claude-code.md](ux-gaps-vs-claude-code.md)** — the terminal-UX half, including where this
  product is ahead and where a difference is deliberate.

---

## How this order was derived

Mostly from the repo, not from scratch. The two framing notes each carry an explicit ranking — the harness
note's *index, in the order worth shipping* (value per unit of work) and the UX note's *where it is behind*
(descending cost to the user) — and the tiers above interleave those two lists, then honour the dependency
statements the task files make about each other.

Three orderings are a judgement call rather than something the files state, and are the ones to overrule
first:

- **`inspection-commands` in Tier 1.** The UX note ranks it third, but it is pure reads over existing
  formats and it is what makes the escalation record in `record-attempted-tasks` visible at all.
- **`resolve-symlinks-in-path-scoping` in Tier 2, not Tier 1.** The false claim in `docs/sandboxing.md` is
  the urgent half; the exploit is not reachable by a non-adversarial model and may not materialize on
  Windows at all. Correcting the doc could be split out and done immediately.
- **The whole of Tier 3 after Tier 2.** These have the largest effect on what the model can actually think
  with, and an argument exists for putting the `num_ctx` and small-model pair much earlier.
