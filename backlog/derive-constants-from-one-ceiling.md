# Derive every budget from one ceiling, in exact tokens

**Category:** Memory / context

From OPEN-QUESTIONS.md **meta F**:

> Lets unify all constants to just one, the maximum context available. Then all the sub-values must be
> derived from it, for example: instead of using 8k tokens for the debate, use 1/2 of the maximum
> context. You will help me finding these values.

Today the repo has one true ceiling (`DEFAULT_NUM_CTX`, 16 384) and roughly twenty independent magic
numbers scattered across `src/`, each justified in its own file's comment. Changing the ceiling moves
none of them, so every budget silently changes meaning relative to the window it lives in.

## The three rulings that shape it (#93)

- **"The maximum context available" is the configured `.env` value** — `OLLAMA_NUM_CTX`, 16 384
  (#93a). Not the model's native `context_length` (which `/api/tags` reports as 32 768 for
  `qwen2.5-coder:14b` and 262 144 for `qwen3-coder:30b`), and not what fits in VRAM. One number, read
  from one place, already the thing every window is measured against.
- **The budgets become exact token counts** (#93b). Characters stop being the unit for anything the
  model reads.
- **Round counts and line caps stay as they are** (#93c) — they bound *effort* and *readability*, not
  window space.

## "Make them exact" turned out to be cheap — verified, not assumed

The obstacle was that Ollama exposes **no tokenize endpoint** (`/api/tokenize` does not exist on
`main`; issue #3582 has been open since 2024 and PR #12030 is unmerged), so the only pre-send count
looked like a probe call that really prefills the text — measured at **4.8–5.4 s per 12 000
characters**. At that price, "exact" would have been unaffordable on a hot path like `read_file`.

**It is not the only way.** `/api/show` with `verbose: true` returns the model's **full BPE vocabulary
and merge table**, so the orchestrator can tokenize locally:

| what | value |
|---|---|
| `tokenizer.ggml.tokens` | 152 064 entries |
| `tokenizer.ggml.merges` | 151 387 entries |
| `tokenizer.ggml.model` / `.pre` | `gpt2` / `qwen2` |
| payload | 4.2 MB, fetched in **2.1 s**, once per model |

A byte-level BPE built from exactly that data was checked against Ollama's own `prompt_eval_count`
(via a `num_predict: 1` probe as ground truth):

| sample | chars | local count | Ollama's count | local time |
|---|---|---|---|---|
| prose | 900 | 201 | **201** | <1 ms |
| prose | 12 000 | 2 666 | **2 666** | 2.1 ms |
| TypeScript | 11 970 | 2 964 | **2 964** | 2.2 ms |
| JSON | 2 280 | 1 520 | **1 520** | 0.5 ms |

**Exact on all four, in ~2 ms instead of ~5 000 ms.** That is what makes #93b buildable: a budget check
costs nothing measurable, and the constitution's *token counts are always exact* invariant is satisfied
by construction rather than approximated.

**Two honest caveats.**

- The vocabulary is **per model**, so it is re-fetched on `/models use` — 2.1 s, once.
- The pre-tokenizer split is keyed on `tokenizer.ggml.pre`, which is `qwen2` here. A different model
  family reports a different value and needs its own regex. The table of splits must **fail loud** on an
  unknown value rather than fall back to a near-enough one — a silently wrong tokenizer produces
  silently wrong counts, which is worse than characters. Every entry is verifiable the same way this one
  was: tokenize locally, compare against `prompt_eval_count`.

## The values, found

### Group 1 — already a fraction of the ceiling

`DEFAULT_SUMMARIZATION_THRESHOLD_RATIO` (0.75) and `DEFAULT_EVICTION_THRESHOLD_RATIO` (0.6), both in
`session/config.ts`. These are the model meta F asks for, applied already. Nothing to do.

### Group 2 — token budgets, derivable exactly

| constant | value | file | derivation |
|---|---|---|---|
| `BOUNDED_ONE_SHOT_NUM_CTX` | 8 192 | `llm/resolve-window-ctx.ts` | **`base / 2`** — exact at 16 384 |

Meta F's own example lands on the number already in the file: 8 192 was chosen as a residency
measurement and *happens* to be half. Nothing says it should stay half if the base moves, which is the
case for this task in one row.

**One hard constraint.** Every **window** role must keep resolving to the base *exactly*, by having no
table entry at all. `contexts.num_ctx` stamps the value each phase context was written under and
`/resume` filters on it, so a derived value reaching a window role would hide every context in every
project. Derivation applies to the **one-shot** roles only.

### Group 3 — the character budgets, and the proposed fractions

Six are model-facing and convert to token budgets. Two are not and should stay in characters — they
bound what a *human* reads, where a token count means nothing.

**Model-facing (convert).** "Today" is the measured range at 4.04–4.50 chars/token:

| constant | today (chars) | today (tokens) | **proposed** | = tokens |
|---|---|---|---|---|
| `REVIEW_DIFF_BUDGET` | 12 000 | 2 666–2 964 | `base × 3/16` | 3 072 |
| `debate` `background` cap | 12 000 | 2 666–2 964 | `base × 3/16` | 3 072 |
| `TRANSCRIPT_BUDGET` | 6 000 | 1 333–1 485 | `base / 12` | 1 365 |
| `READ_FILE_CHAR_LIMIT` | 5 000 | 1 111–1 238 | `base / 14` | 1 170 |
| `TEST_RUN_CAPTURE_LIMIT` | 4 000 | 889–990 | `base / 16` | 1 024 |
| `SPEC_ARCH_LIMIT` | 2 500 | 556–619 | `base / 28` | 585 |

Every proposal is chosen to **preserve today's effective budget**, not to retune it — this task is about
where a number comes from, not about changing what it allows. `base × 3/16` and `base / 16` land
slightly generous; the rest land mid-range.

**Taken as proposed** (#99a): *"use this proposal and we adjust later in testing."* So these fractions
ship as written, and the point of the task is that adjusting them later is a one-line edit in one file
rather than a hunt through eight.

**Human-facing (leave in characters).**

| constant | value | file | why it stays |
|---|---|---|---|
| `DIFF_MAX_CHARS` | 2 000 | `tools/build-file-diff.ts` | bounds the +/- diff rendered in the **scrollback** |
| `OUTPUT_PREVIEW_LIMIT` | 1 024 | `session/audit.ts` | bounds an **audit-log** preview a person reads |

Neither ever enters a prompt, so neither competes for window space. Converting them would make the
ceiling govern something it has no relationship to. **The split is confirmed with the fractions**
(#99a).

### Group 4 — out of scope (#93c)

Round counts (`WORKER_MAX_ROUNDS` 24, `REVIEWER_MAX_ROUNDS` 16, `RETRO_MAX_ROUNDS` 16,
`SUBAGENT_MAX_ROUNDS` 12, `MAX_ROUNDS` 5, `MAX_DEBATE_ROUNDS` 5, `MAX_TOOL_ROUNDS` 8) and line/entry
caps (`READ_FILE_LINE_LIMIT` 250, `list_files` 500 entries, `search_in_files` 200/200/20,
`DEFAULT_LOG_COUNT` 20, `DIFF_MAX_CHANGED_LINES` 20) all stay. A bigger window does not make a
500-entry listing more useful.

## Sequencing

**The tokenizer is the first half and nothing else can precede it.** Two other tasks are waiting on the
unit it establishes:

- [cap-the-debate-background-parameter.md](cap-the-debate-background-parameter.md) — its 12 000-character
  cap is in the table above; shipping it first means writing the cap twice.
- Any later budget, including the wall-clock work, which needs no tokens but sets the precedent for
  where a derived constant lives.
