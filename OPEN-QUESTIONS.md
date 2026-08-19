# Open questions — Tier 2 & 3 investigation pass

Ten agents read one backlog task each and returned 73 questions. **9 are answered** (recorded at the
bottom). **65 remain**, numbered below.

Answer by number, e.g. `12: b` or `12: refuse, and name the model in the line`. Anything you skip
stays blocked — no agent will fill it with a default.

---

## ⚠ One thing needs an answer before the benchmarks run

**#1 — Pulling a small model changes what an unattended boot selects.**
`pickSmallestModel` sorts on disk bytes. Nothing on this box is under 8.9 GB today, so pulling
`qwen2.5-coder:1.5b` and a 3b makes one of them the smallest — and therefore the boot pick on a
fresh `state.json`. That is a live behaviour change caused by a benchmark, unrelated to either task.

- **a.** Pull anyway; the toolless-model filter (task B) will handle it when it lands
- **b.** Pull, and exclude benchmark-only models from `pickSmallestModel` as part of task B
- **c.** Pull, and set `activeModel` explicitly first so the pick rule never fires
- **d.** Something else

---

## A. record-attempted-tasks — Tier 2, Execution loop

*Blocked. `stashTaskAttempt` is `git stash push -u` over the whole tree, so anything the loop writes
into a task's frontmatter is reset to HEAD before the run ends. **#4 decides whether the other four
are even the right questions.***

**#2 — Status vocabulary, or attempt count only?**
A new `TaskStatus` member breaks `TASK_STATUSES`, the validator, the exhaustive `Record` in
`render-task-tree.ts`, `taskSkipReason`, `resolveSelector` and the Breakdown template — but it is
what `/tasks` can actually show.
- **a.** A new status — *and what is it called? The repo has no precedent to copy*
- **b.** `attempts: N` only
- **c.** Both

**#3 — What does re-running a failed task mean?**
- **a.** Retry from scratch, as today
- **b.** Refuse without an explicit flag
- **c.** Retry, but keep counting

**#4 — Where does the record live, and who makes it durable?**
- **a.** The loop commits the frontmatter itself via `commitPaths` — adds a second orchestrator-side
  committer beside Retro's, and amends "Who may commit" in `docs/phases.md`
- **b.** The Reviewer writes it — but it is absent on exactly the MAX_ROUNDS and error paths that need it
- **c.** Git-ignored `.orchestrator/` — durable, survives the stash, invisible in the committed backlog file
- **d.** Write after the stash and accept a permanently dirty tree — *the pre-flights refuse this, so
  it looks non-viable*

**#5 — Is skipping previously-failed tasks the `/run all` default, or opt-in?**
The unattended-batch case and the "I fixed the spec" case point opposite ways.
- **a.** Default: `/run all` skips them
- **b.** Opt-in — *and what flag spelling? `resolveSelector` parses a bare selector only; there is no
  precedent for `/run` flags at all*

**#6 — The apparently-unreachable empty-diff escalation.**
`setTaskStatus('in_progress')` dirties the backlog file for the whole loop, so
`changed.files.length === 0` looks unreachable in round 1. Confirmed by reading, not by execution.
The same dirty file also lands in the Reviewer's diff.
- **a.** Fix here
- **b.** Its own backlog file
- **c.** Leave it

---

## B. boot-can-pick-a-toolless-model — Tier 2, Model behavior

*Confirmed live: `deepseek-coder-v2:16b` reports only `completion,insert`; first tool-capable model
is 83 MB larger. Four call sites, not one. `listModels` projects the capability away before
`pickSmallestModel` sees it.*

**#7 — No installed model has `tools`. What does boot do?**
- **a.** Refuse to boot — honest, but kills `/models pull`, the only in-app fix
- **b.** Boot model-less — reuses machinery that already works end to end (`no model` in the status
  line, an actionable per-turn error); costs you the ability to chat with the toolless model at all
- **c.** Boot on the smallest anyway, loudly warned — chat half-works, every phase fails on round 1

**#8 — What does the failure line say, and what does it tell you to pull?**
`SUGGESTED_MODEL` is `qwen2.5-coder:3b`, which is not installed here and could not be verified as
tool-capable.
- **a.** Reuse `SUGGESTED_MODEL`
- **b.** Name a different model — *which?*
- **c.** Name none; just say "pull a model with tool support"

**#9 — Does the filter apply to a saved `activeModel` in `state.json`?**
The code comments that "the user's own explicit choice always wins".
- **a.** Honour it silently
- **b.** Honour it with a warning
- **c.** Refuse it and fall through to the pick rule

**#10 — Same question for the re-pull offer of a saved-but-missing model.** (a / b / c as above)

**#11 — Does `/models use <name>` get the check?**
- **a.** Refuse
- **b.** Warn and switch anyway
- **c.** Single-keypress confirm, then switch

**#12 — Where does the warning live so it survives `clearScreen`?**
Anything printed during boot is wiped before the REPL starts.
- **a.** A scrollback line beside the existing "no model selected" hint
- **b.** A marker in the pinned status line (`Model: … (no tools)`)
- **c.** Both

**#13 — A daemon that does not report `capabilities` at all — fail open or closed?**
This box's Ollama 0.32.9 reports it; older daemons predate the field. A strict filter would report
"no capable model" on a machine full of them. The repo sets no minimum Ollama version.
- **a.** Fail open (absent = assume capable)
- **b.** Fail closed (absent = assume incapable)

**#14 — Should `/models list` show tool support?**
The natural place to see why a model was skipped, but the task file does not ask for it.
- **a.** Add a column/marker
- **b.** Leave the list untouched

---

## C. node-version-is-not-enforced — Tier 2, Repo hygiene

*You chose: **keep `>=24`, give the check a different justification**. `node:sqlite` demonstrably
works on the v22.14.0 this box runs, and nothing in `src/` needs Node 24.*

**#15 — Where does the check live?**
- **a.** `scripts/run.mjs` — runs first, dependency-free, but duplicates the range (there is
  precedent: `SAFE_NAME` is already a deliberate copy with a "change one, change the other" comment)
- **b.** `src/index.ts` beside the existing `fail()` calls — can read `package.json`, but runs *after*
  Docker comes up, which the task file calls "the wrong end"
- **c.** `.npmrc` `engine-strict=true` — free, but install-only and prints npm's message, not one
  naming the reason
- **d.** More than one of these — *which?*

**#16 — Which entry points are gated?** `run.mjs` has three verbs.
- **a.** All three (`install`, `start`, `stop`)
- **b.** `install` + `start`
- **c.** `start` only

**#17 — Refuse, or warn?**
Given you kept `>=24`, a hard refusal makes this repo unrunnable on this machine today, for a
failure that does not occur.
- **a.** Hard `process.exit(1)`
- **b.** Warn and continue
- **c.** Refuse on `start`, warn on `install`

**#18 — Exact wording, and does it still name `node:sqlite`?**
That is no longer the reason, since you kept the floor on other grounds.
- **a.** Give me the line verbatim
- **b.** Draft it and show me for review

**#19 — Does the `.nvmrc` finding change the task?**
`.nvmrc` already pins 24.14.0 and the task file never mentions it.
- **a.** The real fix is making the shell honour `.nvmrc` — machine setup, no code
- **b.** Still an in-process check
- **c.** Both

**#20 — Do the stale premises get corrected, or just dropped?**
Both the task file and `backlog/README.md` assert a failure that does not occur.
- **a.** Correct them in the shipping commit, then delete the task file
- **b.** Delete the task file and rewrite the README line to describe what was actually found

**#21 — May the agent touch `README.md`?**
Its "Node 24 LTS" line is one of four places the version is declared. CLAUDE.md forbids editing
README unasked, and it is already dirty.
- **a.** Yes
- **b.** No — leave it inconsistent
- *Separately: its Commands section lists `npm run sandbox:up` / `sandbox:down`, which no longer
  exist in `package.json`. Fix, or leave?*

---

## D. spawned-windows-have-no-failsafe — Tier 3, Memory / context

*The sequencing keystone. Reviewer, Retro, sub-agent and both debate windows have no bound at all.
`WorkerWindow.beforeModelCall` already exists (from `075e2da`) — what it lacks is summarization.
`subagents.ts` has no seam at all: `runTurns` never calls `processMessage`.*

**#22 — Which windows are in scope?**
Six growing arrays exist, not the four the file names — the debate `challenger` and `proponent`
accumulate across five rounds carrying the uncapped `background` at index 1.
- **a.** All six
- **b.** The four named; the debate pair belongs to task E
- **c.** Only what the ceiling-lowering tasks need (Worker head-heavy + Reviewer + Retro)

**#23 — Does a spawned window summarize, or compact without inference?**
Summarizing costs a real one-shot — 15.0 s on the 14b, 38.4 s on the 32b — inside an unattended
`/run all`. The repo never says whether that pause is acceptable in a batch.
- **a.** `oneShot('summarize')`, mirroring the interactive failsafe
- **b.** Non-inference compaction — drop the oldest exchange whole, no model call
- **c.** Refuse to compact and terminate the window loudly, on the grounds that a Worker that has
  lost its head is not producing trustworthy work anyway

**#24 — What does a spawned window keep verbatim, and where does the summary sit?**
Index 1 is the *seed* — that window's entire contract (task + spec slice for the Worker; Worker
summary + changed files for the Reviewer; misunderstanding + answer + stashed diff for Retro).
Nothing in the repo says the seed is protected.
- **a.** Protect `[0]`+`[1]`, append the summary last (as the interactive failsafe does)
- **b.** Protect `[0]` only
- **c.** Protect `[0..1]` and splice the summary where the collapsed turns were

*Note: the task file's argument that putting the summary first makes compaction cheap is **false** —
the cached prefix dies at the first collapsed index either way. This is purely about what the model
reads.*

**#25 — What is the trigger?**
Eviction is 0.6 and summarization 0.75, deliberately ordered so the cheap instrument goes first. For
a window with both, the repo says nothing.
- **a.** Reuse 0.75
- **b.** A third ratio — *what value?*
- **c.** Fire only when an eviction pass declined (the head-heavy signal) — free of a new number, but
  couples two mechanisms the code currently keeps separate

**#26 — The sub-agent.**
Needs the most work (no turn-loop seam) and has the least evidence.
- **a.** Measure a 12-round sub-agent's peak first, decide with data
- **b.** Give it the hook regardless
- **c.** Declare `SUBAGENT_MAX_ROUNDS = 12` a sufficient bound and record why in `subagents.ts`

**#27 — What does a spawned compaction emit?**
Eviction emits `eviction_fire` with exact before/after counts.
- **a.** Reuse `summarization_fire` with a phase field
- **b.** A new event type
- *And for a sub-agent: does the row carry `subagentId` the way `subagent_spawn` does?*

---

## E. cap-the-debate-background-parameter — Tier 3, Memory / context

*The cap half is shippable alone — two agents concluded that independently. Five places assert
`background` is uncapped, not two, so even the cap-only half must touch `resolve-window-ctx.ts`.
There is **no tokenizer in the repo**, so any cap is in characters.*

**#28 — What is the cap, in characters?**
Three defensible precedents exist; the file names only the first.
- **a.** 12 000 — `REVIEW_DIFF_BUDGET`, ≈3 080 tokens
- **b.** 6 000 — `TRANSCRIPT_BUDGET`, the other model-facing budget, chosen for a one-shot ceiling
- **c.** 5 000 — `READ_FILE_CHAR_LIMIT`; `background` is most often file content that already arrived
  through `read_file` cut at 5 000
- **d.** A number you name

*This choice largely decides whether the ceiling half is possible at all.*

**#29 — Truncate, or refuse the call?**
The repo splits on authorship: orchestrator-read text is truncated; the one over-limit *model-written*
argument (`ask_user`'s question list) is **refused** with an actionable message. This is model-written
text, so it can comply.
- **a.** Truncate
- **b.** Refuse with a hint to shorten `background`
- **c.** Truncate below one threshold, refuse above a second

**#30 — If truncating: head-only or head+tail, and is the model told?**
Every other bound in the repo announces itself — but here the notice tells the model its own input
was trimmed.
- **a.** Head-only, silent
- **b.** Head-only + notice
- **c.** Head+tail via `truncateHeadTail`'s built-in marker
- **d.** Head+tail + an explicit notice line in the Material section

**#31 — Does the cap live in the tool or the loop?**
There is exactly one caller today, so nothing in the repo decides it.
- **a.** `debate.ts` — bounds it once at the entry gate
- **b.** `run-debate.ts`'s `materialSection` — bounds what is actually re-sent, and covers any future caller

**#32 — Does a cap that fired get recorded?**
- **a.** Nothing extra
- **b.** A flag or dropped-character count on the existing events row
- **c.** On the `metadata` beside `debatePromptTokens`
- **d.** On the summary line you read

**#33 — Do the five phase files learn the bound?**
All five currently push toward *more* material — "anything you leave out of `background` does not
exist to them" — now against a ceiling.
- **a.** Leave them; the tool description carries it
- **b.** Add the budget to the `background` parameter description in `debate.ts` only
- **c.** Amend all five phase files

**#34 — Should the ceiling half be attempted in this task at all?**
You ruled that proof discharges the ceiling gate per window. The two debate roles hold a *growing*
window, unlike the three roles already in the bounded group.
- **a.** Ship the cap; re-file the ceiling with a measurement
- **b.** Ship both if the measurement clears
- **c.** Drop the ceiling half permanently — a growing window does not belong in a group defined as
  "input has a known hard maximum"

---

## F. tune-the-global-num-ctx-default — Tier 3, Memory / context

### ✅ Benchmark complete — results below

Every figure from Ollama's own response fields. Fixed 4 548-token prompt, `num_predict` 128, temp 0,
seed 42, KV prefix cache busted per call, A/B/A/B blocks, warm-up discarded.

**Residency — the task file's premise was wrong.**

| model | `num_ctx` | in VRAM | total | spilled |
|---|---|---|---|---|
| 14b | 12 288 | 10.69 GB | 11.61 GB | **0.92 GB** |
| 14b | 16 384 | 10.49 GB | 12.42 GB | 1.93 GB |
| 32b | 12 288 | 10.58 GB | 23.39 GB | 12.80 GB |
| 32b | 16 384 | 10.35 GB | 24.49 GB | 14.13 GB |

The 16 384/14b row reproduces the recorded table exactly. But **12 288 is not fully resident either** —
the residency cliff sits *below* 12 288. The choice is less-spill vs more-spill, never resident vs not.

**Generation throughput (median)**

| model | 12 288 | 16 384 | cost of 16 384 |
|---|---|---|---|
| 14b | **25.09 tok/s** | 17.79 tok/s | **−29.1 %** |
| 32b | 3.13 tok/s | 2.91 tok/s | −6.8 % |

Prefill is barely affected (−4.4 % on the 14b). The penalty is generation-side memory bandwidth.

**Window-fill sweep, 14b** — the penalty is roughly constant across fill, so it compounds with fill
decay rather than washing out:

| fill | 12 288 | 16 384 | penalty |
|---|---|---|---|
| 2 027 tok | 24.97 | 18.72 | −25.0 % |
| 6 186 tok | 23.05 | 16.28 | −29.4 % |
| 11 239 tok | 19.54 | 14.38 | −26.4 % |

**The decisive line: a 91 %-full 12 288 window (19.54 tok/s) generates faster than a nearly-empty
16 384 window (18.72 tok/s).**

Two further findings:

- **8 192 is now disproved a third way.** At 8 192 the *summarization* threshold (0.75 × 8 192 =
  6 144) falls below Breakdown's 7 283-token fixed overhead, so both failsafes would fire on turn
  one. At 12 288 both clear (eviction 7 373 > Worker 5 432; summarization 9 216 > Breakdown 7 283).
- **The ceiling-change runner rebuild is ~16–18 s on the 32b**, not the ~3.3 s recorded for the 14b
  (measured at ~4.3 s here). A bounded one-shot's down-and-back therefore costs **~33 s on a 32b** —
  which may make the whole 8 192 one-shot lane a net loss on large models. Bears directly on **#53**.

---

**#68 — What is the number? (new — this is the decision the benchmark existed to inform)**
On the 14b, 16 384 buys 4 096 tokens of ceiling for **29 % of generation speed**. The agent
pre-registered ">30 % *and* 12 288 fully resident" as its threshold for a strong answer; neither half
fired cleanly, so it declined to round it into a verdict. The trade, concretely:

| | 12 288 | 16 384 |
|---|---|---|
| Worker working room | 6 856 tok | 10 952 tok |
| Discovery working room | 5 160 tok | 9 256 tok |
| Generation (14b) | 25.1 tok/s | 17.8 tok/s |

- **a.** Move to 12 288 — buy 29 % speed, lose 4 096 tokens of room everywhere
- **b.** Stay at 16 384 — keep the room, record the measured cost and close the file
- **c.** Split by model (see #37) — the data says one global number is wrong for one of the two
- **d.** Measure further first — *what would settle it for you?*

**#35 — Migration — which of the three?**
- **a.** Accept the hide — free today
- **b.** One-time `UPDATE contexts SET num_ctx` — asserts something false about what those turns ran under
- **c.** Relax the predicate from `num_ctx = ?` to `num_ctx <= ?`, plus a warning in `/resume`

**#36 — Should option (c) ship regardless of whether the number ever changes?**
Equality already hides contexts that would replay perfectly safely into a *larger* window — arguably
a standalone defect.
- **a.** Yes, ship it as its own fix
- **b.** No, only if the number moves

**#37 — Per-model ceilings — now or deferred?**
**The benchmark now argues for this rather than leaving it open.** The cost of 16 384 is 29.1 % on the
14b but only 6.8 % on the 32b — because the 32b is 12.8 GB offloaded at *either* ceiling, so the extra
1.33 GB of KV is marginal. One global number is demonstrably wrong for one of the two models.
Still collides with `contexts.num_ctx`: a ceiling following `/models use` changes mid-session, while a
context is stamped once at creation.
- **a.** Defer; keep one global number anyway, and record which model it is right for
- **b.** In scope now, and the stamping design changes with it

*(Incidental: the 32b runs at ~3 tok/s regardless of ceiling — roughly 8× slower than the 14b at
12 288. Ceiling choice is not what makes it slow.)*

*(`OLLAMA_KV_CACHE_TYPE` was declined as a fourth benchmark arm. It is now **more** interesting than
when you declined it, since neither candidate ceiling turned out to be fully resident — a q8_0 KV
cache could halve the spill at 16 384 without giving up any room. Say if you want it filed as its own
backlog item rather than dropped.)*

---

## G. budget-ceilings-for-runs-and-batches — Tier 3, Execution loop

*Every seam exists; blocked on decisions only. Follows task A, which sets the vocabulary this
extends. **There is no `Σ` on the status line** (stale comment only) and **no per-task wall clock**.*

**#38 — Tokens, wall clock, or both?**
Tokens reuse everything that exists; wall clock is entirely new plumbing but the only thing that
catches a wedged-but-chatty run.
- **a.** Tokens only
- **b.** Wall clock only
- **c.** Both, as two independent ceilings
- **d.** Both, whichever trips first

**#39 — What does a crossed *task* ceiling produce?**
The file says `escalated` — but `escalated` is a *judgement* (five rounds tried, none passed), and
`cancelled` exists precisely so an un-judged ending is never reported as one.
- **a.** Reuse `escalated` with a budget reason, weakening the distinction
- **b.** Reuse `cancelled`
- **c.** A fifth outcome, e.g. `over_budget`

**#40 — Does a crossed task ceiling stop the batch?**
The file says keep going. But `cancelled` **ends** the batch today while `escalated` continues — so
answering #39 with (b) silently reverses the file's stated intent.
- **a.** Keep going, as the file says
- **b.** End the batch

**#41 — Are the two ceilings independent, and what does a batch ceiling mean for `/run <one-id>`?**
A single task never enters `runBatch` at all.
- **a.** Batch ceiling applies only to true batches; a single task is bounded by the task ceiling alone
- **b.** The batch ceiling also wraps `runSingle`
- **c.** A batch ceiling implies a task ceiling when the task one is unset

**#42 — Where do the numbers live?**
`/run` currently parses exactly one argument; a second means changing the parser, the completer, the
usage string and the docs.
- **a.** `.env` only
- **b.** `.env` plus a per-invocation override
- **c.** `/run` argument only

**#43 — What does "no ceiling" mean?**
- **a.** Unset = unlimited (today's behaviour, no surprise)
- **b.** A shipped default that starts bounding runs the moment this lands — *what value?*

**#44 — What happens when the sum is unknown?**
Reachable: a null poisons the sum rather than coercing to zero. The constitution says surface it, not
which way to fail.
- **a.** Fail-closed — refuse the next round, end the task saying it cannot be budget-checked
- **b.** Fail-open — warn loudly, keep going, so a missing metric never costs a night's work
- **c.** Fail-closed for the batch, fail-open for the task

**#45 — Check granularity.**
Round boundaries mean up to 24 Worker model calls between checks — a task can overshoot substantially.
- **a.** Round boundaries only — simplest, no new hooks
- **b.** Hook `beforeModelCall` and check before every call

**#46 — What do you see live, if anything?**
There is no `Σ` today, and Worker/Reviewer tokens never reach `activePhaseTokenTotal`.
- **a.** Nothing live
- **b.** Task spend
- **c.** Batch spend
- **d.** Both — *and against what denominator when no ceiling is set?*

**#47 — Small: file layout.**
`config.ts` already holds four functions, against the one-function-per-file rule.
- **a.** Add the budget resolver there for local consistency
- **b.** Split it into its own file

---

## H. surface-matching-standards — Tier 3, Model behavior

***The measurement this task defers to already exists**: the catalog is 530 exact tokens with
descriptions, ~50 for the nine slugs alone. **"Seed time" is not one moment** — the Reviewer is a
fresh window every round, up to 5 per task.*

**#48 — Hint, resident names-only, or resident names + descriptions?**
The fork the measurement opens. *If this goes to (b) or (c), the rest of this section changes
wholesale.*
- **a.** One hint per seed, as the file proposes — zero resident cost, one extra call, one name
- **b.** Resident **names only** (~50 tokens/turn, ~0.3% of 16k) with `load_rule` called directly;
  the slugs are unusually self-describing (`testing-discipline`, `error-handling`)
- **c.** Resident **names + descriptions** (~530 tokens/turn, against a Worker floor already at
  5 432) and `search_rules` retired
- **d.** Hint *and* resident names

**#49 — How many rounds does the Reviewer get hinted?**
- **a.** Round 1's Reviewer only
- **b.** Every Reviewer window (up to 5 extra calls per task)
- **c.** No Reviewer at all

**#50 — What text is matched, for each phase?**
- Worker: **a.** `task.title` + `task.body` · **b.** those plus the spec slice
- Reviewer: **c.** the same task text (identical hint, identical cost) · **d.** the Worker's summary
  + changed files, which is what it is actually judging and would produce a *different* hint

**#51 — Top-1 or top-N, and what happens on no match?**
- **a.** Omit the line entirely — the seed reads exactly as today
- **b.** State "no standard matched — call `search_rules` if you need one"
- *And on a transport failure or missing prompt file: skip silently like `generateContextTitle`, or
  fail the task?*

**#52 — Should the hint's *body* ever be injected?**
The file says name-only so the model stays the one who decides — but `worker.md` and `reviewer.md`
already order an unconditional `load_rule("simplified-technical-english")`, so "never inject" is not
the repo's current position.
- **a.** Name only
- **b.** Name only, but suppress the hint when it duplicates the hardcoded standard
- **c.** Inject the body when the match is confident

**#53 — Which `num_ctx` ceiling?**
A bounded role costs a runner rebuild per call; a base-ceiling role costs nothing. **The num_ctx
benchmark revised this cost sharply upward: the rebuild is ~4.3 s on the 14b but ~16–18 s on the 32b,
so a bounded one-shot's down-and-back is ~33 s on a large model, not the ~6.6 s previously recorded.**
That may make the entire 8 192 one-shot lane a net loss on the 32b — which is a question about
`resolve-window-ctx.ts` as a whole, beyond this task.
- **a.** Base — no table entry, no rebuild
- **b.** Bounded 8 192 — residency, but ~33 s per hint on a 32b, fired twice per task
- **c.** Reuse the existing `search-rules` role rather than adding one
- *Separately: should the newly-measured 32b rebuild cost be filed as its own backlog item against
  the bounded one-shot lane?*

**#54 — Escalate an ignored hint to the Reviewer?**
Needs per-window tracking of `load_rule` calls, which does not exist.
- **a.** No escalation
- **b.** Tell the Reviewer which standard was hinted, without saying whether it loaded
- **c.** Tell it the Worker never loaded it — a way to fail a task on a technicality

**#55 — Worker and Reviewer only, or every phase with `search_rules`?**
Discovery, Design, Breakdown and Retro all hold the tools and all have a seed. The file names only
the two execution phases and gives no reason.
- **a.** Worker + Reviewer
- **b.** Every phase

**#56 — Is the hint surfaced to you?**
Not a tool call, so no `→`/`←` row.
- **a.** Events-log row only (the `context_title` precedent)
- **b.** A row plus one printed line, since you wait through the call (the `eviction_fire` precedent)
- **c.** Neither

---

## I. small-model-lane-for-one-shots — Tier 3, Memory / context

*Benchmark authorized but **held on #1** (the pull changes the boot pick). The deferral currently
holds. **"13–22 s" is not the marginal cost** — the three roles that would move already pay ~6.6 s of
runner rebuild, so the true marginal is hop − 6.6 s.*

**#57 — Is the CPU-pinned arm (`options.num_gpu: 0`) in scope?**
The only design where the big model is never evicted, so there is no hop at all. Never considered in
the record; a per-call option this repo has never used. *I have assumed **yes**, since you chose to
run the benchmark whole — say if not.*
- **a.** Include it
- **b.** Exclude it
- **c.** Its own backlog file

**#58 — What result would you accept as decisive?**
A product decision the repo does not state.
- **a.** Strictly faster than today
- **b.** No worse than today, plus a residency gain
- **c.** Latency-agnostic if quality holds

**#59 — Do the numbers get written down even if they confirm the deferral?**
The README already records the first measurement, which suggests yes — but the file is meant to be
deleted when work ships, and a confirmed deferral ships nothing.
- **a.** Record in the task file and leave it open
- **b.** Record and close the file with the reason
- **c.** Record in `docs/open-questions.md`, where the question is already listed

**#60 — If the benchmark favours the lane, does it get built in this pass?**
Not asked by the agent, but it follows: a second model resolution point, a second `activeModel`, a
second `/models use` form, and token counts summed from two tokenizers.
- **a.** Build it
- **b.** Record the finding and re-file the build as its own task

---

## J. in-turn-progress-reporting — Tier 3, Terminal UX

*Reporter-side, zero model tokens. **Neither status line is clamped to width today** — you ruled that
fix folds in here. The scrollback is already far richer than the file claims; what is missing is live
aggregate position, not a record.*

Proposed rows:

```
Worker · round 3/5 | task 3/12 T-042 add pagination to /notes | Ctx: 71% | Σ 48,231
Model: qwen2.5-coder:14b | Project: notes-api
```

**#61 — Does the live window replace `Phase:`, append to it, or get its own field?**
- **a.** `Worker · round 3/5` replaces `Phase: Design` for the duration — shortest
- **b.** `Phase: Design → Worker` — the more honest
- **c.** `Phase: Design | Run: Worker`

**#62 — Field priority when the row will not fit?**
Proposed drop order, right to left: `Σ` → task title → batch position → task id → round, with
Model/Project last.
- **a.** As proposed
- **b.** A different order — *which?*

**#63 — What does `Ctx: N%` mean while a Worker round runs?**
Today it is the *interactive* phase's fill — a frozen number about a window nobody is watching.
- **a.** Leave it interactive-phase
- **b.** Show the live window's exact fill over its own ceiling
- **c.** Show both
- *If (b): before the window's first turn there is no exact figure, and the constitution forbids
  inventing one. Blank, or omit the field?*

**#64 — Is live cumulative spend in scope here, or does it belong to task G?**
It needs a new reporter callback or an exposed `tokens` getter — a seam signature.
- **a.** Here
- **b.** Task G owns it
- **c.** Neither; no live spend field

**#65 — Should anything new be printed to the scrollback?**
A per-round record already lands there.
- **a.** Nothing new
- **b.** A closing line per round — e.g. `⏱ round 3/5 · 14m22s · 12 tool calls · 48,231 tokens`
- *This also decides whether a redirected, non-TTY run gets any progress at all.*

**#66 — Where does the live window name come from?**
- **a.** `ctx.activePhase` at the existing hook — free, also covers Retro, debates and sub-agents,
  but requires depth-stacking `status-activity` and widens a core file's UI coupling
- **b.** Two new reporter methods — explicit and `/run`-scoped, but Retro and debates stay invisible

**#67 — What shows while a sub-agent runs, and should `Subagents: N` finally exist?**
Two comments in `orchestrator.ts` already claim that field and no code paints it.
- **a.** Nothing — a sub-agent is just another tool call on the activity line
- **b.** A `[sub:01JQ]` marker in the window field, matching the scrollback convention
- **c.** The `Subagents: N` field as originally commented

---

## Already answered

1. **GPU budget** — both benchmarks authorized; `OLLAMA_KV_CACHE_TYPE` declined as a fourth arm
2. **Ceiling gate** — *proof suffices, per window*: a measurement releases a window's ceiling without
   waiting for the failsafe to ship
3. **Node floor** — keep `>=24`; find a different justification for it
4. **Adjacent defects** — fold in when it is the same fix; anything needing separate design gets its
   own backlog file
5. **num_ctx benchmark model** — both 14b and 32b
6. **num_ctx candidates** — 12 288 and 16 384; 8 192 dropped as already disproved
7. **Small models to pull** — two, compared: `qwen2.5-coder:1.5b` and a 3b
8. *(A#5)* The `blocked`-status stash defect folds into task A
9. *(J#62)* The missing status-row clamp folds into task J
