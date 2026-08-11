# Backlog checklist

An index of the 19 open task files in this folder, in the order worth shipping, plus the 2 framing notes
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
- [ ] **[Show what a tool call actually did](show-tool-calls-in-the-scrollback.md)** — *Terminal UX.* The
      largest UX gap after cancel and the cheapest to close — `args` is already in hand one line above the
      print, and every result already passes the audit log's choke point. A record, not a confirmation
      prompt. **All four of its open decisions are answered** (in the file), and the read-before-write guard
      shipped first on purpose: `write_file` now reads before it overwrites, so the true GitHub-style diff
      for both write tools costs no round-trip it was not already paying.
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
      task reverts to `pending`, so a second overnight `/run all` re-fails the first one's tasks. Pairs with
      [budget-ceilings-for-runs-and-batches.md](budget-ceilings-for-runs-and-batches.md) — both need an
      outcome the backlog can see.
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
