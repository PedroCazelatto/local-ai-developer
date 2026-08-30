# Backlog checklist

An index of the 21 open task files in this folder, in the order worth shipping, plus the 2 framing notes
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
      persistence, no model call, and none of them reachable by a phase.

## Tier 2 — defects and misleading code

Not parity gaps. Each is a place where the repo currently says something that is not true.

- [ ] **[Stop a failed task looking untouched](record-attempted-tasks.md)** — *Execution loop.* An escalated
      task reverts to `pending`, so a second overnight `/run all` re-fails the first one's tasks. **Fully
      answered and ready to build:** a fifth `TaskStatus` (`failed`), written after the stash and committed by
      the loop via `commitPaths`, so no dirty-tree gate has to learn an exception. Pairs with
      [budget-ceilings-for-runs-and-batches.md](budget-ceilings-for-runs-and-batches.md) — both ship the same
      vocabulary for "ended without a verdict". Its `docs/phases.md` "Who may commit" edit is review-gated.
- [ ] **[Boot can pick a model that cannot call tools](boot-can-pick-a-toolless-model.md)** — *Model
      behavior.* `pickSmallestModel` sorts on disk bytes and never asks what the model can do, so the
      first-run path — no `state.json`, no model named at boot — can select a model whose `/api/tags`
      capabilities are `completion,insert`. **The answer is now to delete the pick rule, not filter it:** a
      saved `activeModel` wins, otherwise the user chooses from a marked list, and toolless models are shown
      but never selectable. Re-measured live — 3 of the 9 models installed here have no `tools`, and
      `/api/tags` carries `capabilities` in one round trip (Ollama >= 0.9.1, researched). Two follow-ups are
      open: the now-unpaintable `(no tools)` status marker, and whether a version check ships.
- [ ] **[The required Node version is never enforced](node-version-is-not-enforced.md)** — *Repo hygiene.*
      `engines` says `>=24` because `node:sqlite` is unflagged there, and nothing checks it — the machine
      this repo is developed on runs v22.14.0. Expected to fail when the session opens `memory.db`, which
      is the wrong end of the problem to be told about. **Confirming that failure is part of the task.**
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

## Tier 3 — context economy and throughput

Where the window is also a clock. Two of these want measurement before design.

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
- [ ] **[The spawned windows have no failsafe, and no record](spawned-windows-have-no-failsafe.md)** — *Memory / context.*
      `beforeModelCall` exists only on `SessionOrchestrator`, so the Worker, Reviewer, Retro and sub-agent
      windows have no compaction at all and Ollama silently drops their oldest tokens past `num_ctx` —
      demonstrated, not inferred. **All six windows are in scope** (the debate pair joined), they summarize
      rather than drop, and `[0]`+`[1]` are protected because index 1 is the window's seed — its contract.
      **The scope grew a second half:** spawned windows now persist their whole trace into `contexts` +
      `messages`, so a Worker's reasoning is readable after the fact rather than destroyed with the window.
      Pairs with the eviction item above: eviction bounds the tail-heavy case cheaply, and only a failsafe
      bounds the head-heavy one. Spawned rows are namespaced `worker:spawned`, which a filename-derived
      phase name can never equal, so `/resume`'s existing filter excludes them by construction — no column
      and no migration. **Fully answered; ready to build.**
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
      titles, commit messages or summaries than the session model. The CPU-pinned arm was ruled out (#57) and
      the two small models were never pulled, so no benchmark was spent on it either.
- [ ] **[Cap `debate`'s `background` parameter](cap-the-debate-background-parameter.md)** — *Memory /
      context.* The one model-supplied payload in the repo with no bound, replayed into two windows on
      every call — up to ten times in one debate. `run-debate.ts` already names the hazard for the third
      window while leaving it uncapped for the first two. Prerequisite for letting `debate-turn` and
      `debate-digest` take a reduced ceiling in `src/core/llm/resolve-window-ctx.ts`, where they are
      pinned to the base for exactly this reason.
- [ ] **[Is 16 384 the right `OLLAMA_NUM_CTX`?](tune-the-global-num-ctx-default.md)** — *Memory / context.*
      **Answered: it stays at 16 384.** The benchmark ran on both models — 16 384 costs 29.1 % of generation
      throughput on the 14b and 6.8 % on the 32b, and 12 288 is *not* fully resident either, so the choice was
      never resident vs. hybrid. The room is worth more than the speed. Per-model ceilings deferred (they
      collide with `contexts.num_ctx` stamping); nothing to migrate. Spun out
      [resume-across-num-ctx-changes.md](resume-across-num-ctx-changes.md). The CPU collision is resolved by
      a rule — **spill is acceptable while the weights stay resident and only KV cache offloads** — which
      also disqualifies six of the nine models installed here, leaving `qwen2.5-coder:14b` as the only one
      that both fits and reports `tools`; that is now measured, not inferred, with the VRAM ceiling
      confirmed at 10.2–10.7 GB across five models. The list marks it, nothing refuses it, and the machine
      is probed by loading each model once at boot (≈18 s each, ≈2.7 min for nine). **Everything is
      answered — the file closes with the `docs/product.md` diff that carries the rule.**
- [ ] **[Make the standards visible](surface-matching-standards.md)** — *Model behavior.* **The shape
      changed: the resident catalog won.** All nine standard names sit at `ctx[0]` in every phase (~50 exact
      tokens, 0.3 % of the window), and a new `describe_rule` tool returns a one-line description so the model
      can judge a standard before paying for its body. The seed-time match survives as a hint — always top-1,
      every phase, escalated to the Reviewer when the Worker ignored it. No longer a user of the small lane.
- [ ] **[Derive every budget from one ceiling](derive-constants-from-one-ceiling.md)** — *Memory / context.*
      **Fully answered, and the widest-reaching item here** — six budgets across five files take their unit
      from it, so it ships before the debate cap. One ceiling (the `.env` value), every sub-value a fraction:
      `BOUNDED_ONE_SHOT_NUM_CTX` becomes `base / 2`, which is exactly 8 192 today. The character budgets
      become **exact token** budgets, which turned out to be cheap rather than impossible: `/api/show` with
      `verbose: true` serves the model's full BPE vocab and merges, and a tokenizer built from it reproduces
      Ollama's own `prompt_eval_count` exactly in ~2 ms per 12 000 characters. Fractions taken as proposed.
- [ ] **[`/resume` hides contexts written under a different ceiling](resume-across-num-ctx-changes.md)** —
      *Memory / context.* `num_ctx = ?` is strict equality, so anyone who ever changed `OLLAMA_NUM_CTX` has
      unreachable history right now, silently, in every project. Relax the read predicate to `<= ?` and warn:
      a context built for a smaller window replays safely into a larger one, never the reverse. Ships on its
      own merits — the global ceiling is not moving.
- [ ] **[Split `config.ts` into one function per file](split-config-into-one-function-per-file.md)** —
      *Repo hygiene.* The four-function env-resolution exception ends; `config.ts` keeps the constants and the
      type and re-exports the resolvers into the config object. **Ship it before the budget ceilings**, so the
      new resolver is written into the shape that already exists rather than moved afterwards.
- [ ] **[Budget ceilings for a window and a batch](budget-ceilings-for-runs-and-batches.md)** — *Execution
      loop.* **Wall clock only, on model time** — no token ceiling ships, so this is entirely new plumbing
      rather than a comparison against counts that already exist. **Renamed:** every phase swap resets the
      clock and the Worker→Reviewer handover is a swap, so it bounds a *window*, not a task — the rule is *no
      single window may spend more than N minutes in one continuous stretch*, which is the wedged-call
      detector. A crossed ceiling produces a fifth outcome, `over_budget`; the task's dependents stop with it
      and every independent task still runs, which the batch's existing per-iteration `unmet-deps` reload
      gives almost for free. Ships **after**
      [split-config-into-one-function-per-file.md](split-config-into-one-function-per-file.md).
- [ ] **[Steer a running turn](steer-a-running-turn.md)** — *Terminal UX.* **Authorized** (OPEN-QUESTIONS.md
      #91a), promoted out of *Blocked on a decision*: #61's reason for `Phase: Design → Worker` was that *"the
      input is also connected to the running interaction and I can send more messages to the model if I see it
      diverging from the goal"* — which is this feature, not a status-line label. Cancel shipped, so its
      prerequisite is met. Build it **after**
      [in-turn-progress-reporting.md](in-turn-progress-reporting.md), which supplies the label that makes the
      steering legible.
- [ ] **[Show where a long task has got to](in-turn-progress-reporting.md)** — *Terminal UX.* Still
      reporter-side (zero model tokens), but **the scope grew to both halves**: the pinned rows *and* the
      scrollback, which must print what a `/run` is doing as it happens — one interleaved stream coloured per
      phase, a transition line on every swap, a closing line per round. `Phase: Design → Worker T-042` appends
      rather than replaces, and `Ctx: N%` follows the live window, reading an exact `0%` before its first
      response. `Subagents: N` is not built — one sub-agent at a time — and its orphaned comment is deleted.
      Build it before deciding [task-plan-inside-a-task.md](task-plan-inside-a-task.md) — it removes one of
      that task's two justifications.

## Tier 4 — worthwhile, not urgent

- [ ] **[Move both logs into SQLite tables](move-the-logs-into-sqlite-tables.md)** — *Memory / context.*
      **Nothing reads `events.jsonl`** — five event types are written to a file no command surfaces, so an
      unexplained pause has no in-app explanation. Decided: both logs become **two tables** in the existing
      `memory.db`, so the concerns stay distinct in the schema and what unifies is the store and the
      reader. Overturns the "never merged" invariant in `events-log.ts`'s header, and trades the
      flat-file durability argument in `audit.ts`'s for transactions — read both headers first.
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
- **`resolve-symlinks-in-path-scoping` in Tier 2, not Tier 1.** Shipped from Tier 2, and the ranking's
  reasoning was half wrong in a way worth keeping on the record: it argued the exploit "may not materialize
  on Windows at all", which was true of the *link* and false of the *hole*. Windows is precisely where the
  host-side check could not see the link, so the escape worked there and a host-only fix would have shipped
  believing it had closed something.
- **The whole of Tier 3 after Tier 2.** These have the largest effect on what the model can actually think
  with, and an argument exists for putting the `num_ctx` and small-model pair much earlier.

One ordering was overruled in practice, and the reason generalises: the read-before-write guard was pulled
out of Tier 2 and shipped **before** `show-tool-calls-in-the-scrollback`, because the two wanted the same
container round-trip. `write_file` could not diff an overwrite without first reading what it was about to
destroy — which is the guard's read. Two tasks that need the same fetch are one ordering decision, and the
one that makes the fetch happen goes first. Worth checking for elsewhere in this list before picking up the
next item.
