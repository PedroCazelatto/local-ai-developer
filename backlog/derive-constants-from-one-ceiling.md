# Derive every budget from one ceiling

**Category:** Memory / context

From OPEN-QUESTIONS.md **meta F**:

> Lets unify all constants to just one, the maximum context available. Then all the sub-values must be
> derived from it, for example: instead of using 8k tokens for the debate, use 1/2 of the maximum
> context. You will help me finding these values.

Today the repo has one true ceiling (`DEFAULT_NUM_CTX`, 16 384) and roughly twenty independent magic
numbers scattered across `src/`, each justified in its own file's comment. Changing the ceiling moves
none of them, so every budget silently changes meaning relative to the window it lives in.

## The values, found

Every constant in `src/` that bounds something the model reads or writes, grouped by whether it *can*
be derived from a token ceiling.

### 1. Already a fraction of the ceiling — nothing to do

| constant | value | file | as a fraction |
|---|---|---|---|
| `DEFAULT_SUMMARIZATION_THRESHOLD_RATIO` | 0.75 | `session/config.ts` | **is** a ratio |
| `DEFAULT_EVICTION_THRESHOLD_RATIO` | 0.6 | `session/config.ts` | **is** a ratio |

These are the model meta F is asking for, applied already.

### 2. Token budgets — derivable exactly, and the example in meta F is one of them

| constant | value | file | proposed derivation |
|---|---|---|---|
| `BOUNDED_ONE_SHOT_NUM_CTX` | 8 192 | `llm/resolve-window-ctx.ts` | **`base / 2`** — exact at 16 384 |

Meta F's own example lands on the number already in the file. That is the whole case for this task in
one row: 8 192 was chosen as a residency measurement and *happens* to be half; nothing says it should
stay half if the base moves.

**One hard constraint on this group.** Every **window** role must keep resolving to the base *exactly*,
by having no table entry at all. `contexts.num_ctx` stamps the value each phase context was written
under and `/resume` filters on it, so a derived value reaching a window role would hide every context
in every project. `resolve-window-ctx.ts`'s header states this and the persistence path deliberately
cannot import that module. Derivation applies to the **one-shot** roles only.

### 3. Character budgets — the hard group, because there is no tokenizer

| constant | value | file | measured tokens (14b) |
|---|---|---|---|
| `REVIEW_DIFF_BUDGET` | 12 000 | `session/project-git.ts` | 2 666 (prose) – 2 964 (code) |
| `debate` `background` cap | 12 000 | *(new, #28)* | same |
| `TRANSCRIPT_BUDGET` | 6 000 | `session/generate-context-title.ts` | ≈1 350 – 1 500 |
| `READ_FILE_CHAR_LIMIT` | 5 000 | `tools/render-numbered-slice.ts` | ≈1 100 – 1 250 |
| `TEST_RUN_CAPTURE_LIMIT` | 4 000 | `session/worker-runner.ts` | ≈900 – 1 000 |
| `SPEC_ARCH_LIMIT` | 2 500 | `interface/commands/run.ts` | ≈550 – 620 |
| `DIFF_MAX_CHARS` | 2 000 | `tools/build-file-diff.ts` | ≈440 – 500 |
| `OUTPUT_PREVIEW_LIMIT` | 1 024 | `session/audit.ts` | ≈230 – 250 |

Measured directly against the daemon on `qwen2.5-coder:14b` with a `num_predict: 1` probe, reading
Ollama's own `prompt_eval_count`: **4.50 chars/token for English prose, 4.04 for TypeScript source.**

**This group is where the task's real decision is.** Deriving a *character* budget from a *token*
ceiling requires a chars-per-token constant, and the constitution's correctness invariant is that token
counts are always exact and never length-derived. Converting one to the other in either direction is
precisely the estimate that rule forbids. Three ways out, none free — see #93.

### 4. Not context-derived at all — proposed out of scope

Round counts (`WORKER_MAX_ROUNDS` 24, `REVIEWER_MAX_ROUNDS` 16, `RETRO_MAX_ROUNDS` 16,
`SUBAGENT_MAX_ROUNDS` 12, `MAX_ROUNDS` 5, `MAX_DEBATE_ROUNDS` 5, `MAX_TOOL_ROUNDS` 8) bound *effort*,
not window space. Line and entry caps (`READ_FILE_LINE_LIMIT` 250, `list_files` 500 entries,
`search_in_files` 200/200/20, `DEFAULT_LOG_COUNT` 20, `DIFF_MAX_CHANGED_LINES` 20) bound *shape* — they
exist so output is readable, and a bigger window does not make a 500-entry listing more useful.

Including them would make "derived from the ceiling" mean nothing. Confirm the exclusion before
building (#93).

## Why there is no tokenizer to make group 3 easy

Ollama exposes **no tokenize endpoint**. `/api/tokenize` and `/api/detokenize` do not exist on `main`;
the request (issue #3582) has been open since 2024 and PR #12030 is unmerged. The exact counts this
repo relies on are *results* of completed calls, not a service that can be queried.

The only way to count before sending is a probe that really prefills the text — an `/api/generate` with
`num_predict: 1`, measured at **4.8–5.4 s for 12 000 characters** on an already-loaded 14b, plus a
runner rebuild if its `num_ctx` differs from the session's. (`num_predict: 0` does **not** work: Ollama
treats it as unset and generates to the ceiling — a 12 000-character probe ran for over ten minutes
before it was killed.)

## Still open

- **#93 — three decisions this task cannot start without**: what "the maximum context available" names
  (the configured `OLLAMA_NUM_CTX`, the model's own `context_length`, or what fits in VRAM); how a
  character budget may be derived from a token ceiling without violating the exact-counts invariant;
  and whether groups 4 (rounds, line caps) are excluded as proposed. See
  [OPEN-QUESTIONS.md](../OPEN-QUESTIONS.md) #93.
