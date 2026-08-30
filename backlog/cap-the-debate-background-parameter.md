# Cap `debate`'s `background` parameter

**Category:** Memory / context

`background` is free text the *model* writes (`debate.ts:64-70`). It is validated only as "a string when
given", and trimmed. **There is no cap anywhere.** It is the one model-supplied payload in the repo with
no bound.

Every sibling is bounded, and deliberately: `read_file` (250 lines or 5 000 characters), `search_in_files`
(200 output lines · 200 matches · 20 per file), `git_inspect` (default 20), `list_changes` (paths, never a
diff), `REVIEW_DIFF_BUDGET` (12 000 characters, for both the commit-message writer and the Retro stash
diff), and `truncateHeadTail` for shell output.

## Why it costs more than it looks

`materialSection` (`run-debate.ts:168-171`) puts `background` into the challenger's seed **and** the
proponent's seed. Each of those windows then replays its own history on every subsequent call, so a single
oversized `background` is re-evaluated **up to ten times in one debate**.

The measured floor of a five-round debate is already **6 706 prompt tokens** from the three system prompts
alone (challenger 653, proponent 584, digest 521, each re-sent on every call) — before the claim, the
reasoning, the material, or one word of argument. A 4 000-token `background` adds roughly 40 000 on top of
that.

The digest window deliberately omits `background`, and the comment at `run-debate.ts:207-211` says why: *"a
large `background` replayed a third time is exactly the num_ctx spend this loop exists to avoid."* So the
hazard is already named in the code — for the third window, while the first two carry it uncapped.

## It is also a prerequisite

The per-window `num_ctx` work shipped with `debate-turn` and `debate-digest` pinned to the **base**
ceiling as unbounded one-shots, precisely because an uncapped input under a smaller ceiling is silent
truncation. Capping `background` is what would let them join the bounded group — the table and the
reason are in `src/core/llm/resolve-window-ctx.ts`, and `DebateDeps.oneShot` says the same thing where
the two roles are actually passed.

## Decisions (answered — OPEN-QUESTIONS.md #28–#34)

- **The cap is 12 000 characters** (#28a) — `REVIEW_DIFF_BUDGET`'s number, the repo's existing bound on
  material handed to a model.
- **Over-limit `background` is truncated, not refused** (#29a). This is a deliberate departure from the
  repo's authorship rule (model-written text is refused, orchestrator-read text is truncated): a
  refusal costs a wasted tool call inside an unattended batch, and `debate` is meant to be reached for
  routinely.
- **Head + tail, via `truncateHeadTail`, with its built-in elision marker** (#30c). `background` pasted
  from a file often has its conclusion at the end, so head-only would cut exactly the part worth
  keeping. **No separate notice line** beyond the marker the instrument already writes.
- **The cap lives in `debate.ts`** (#31a), at the entry gate where the argument is already validated
  and trimmed — not in `run-debate.ts`'s `materialSection`.
- **A cap that fired is recorded on the existing `debate` events-log row's `metadata`, beside
  `debatePromptTokens`** (#32c). No new event type, and it sits next to the only other durable record
  of what those throwaway calls cost.
- **Both the parameter description and the five phase files learn the bound** (#33 — b *and* c). The
  `background` parameter description in `debate.ts` carries the budget so the model reads it at the
  point of use; the five phase files are amended because they currently push toward *more* material
  ("anything you leave out is a fact the debate cannot use"), which now runs against a ceiling.
  **Constitution note:** the `rules/` edits are committed like ordinary work when *this agent* makes
  them — it is the *local model* rewriting `rules/` at runtime that is left uncommitted.
- **Ship the cap; re-file the ceiling with a measurement** (#34a). `debate-turn` and `debate-digest`
  stay at the base ceiling in `resolve-window-ctx.ts` for now, and the comment there is rewritten: the
  reason is no longer "`background` is uncapped" but "a debate window *grows*, and the bounded group's
  defining property is an input with a known hard maximum".

## The cap in tokens, measured rather than estimated

There is no tokenizer in the repo, so the cap is expressed in characters (#28). What 12 000 characters
actually costs was measured directly against the daemon on `qwen2.5-coder:14b`, using a
`num_predict: 1` probe and reading Ollama's own `prompt_eval_count`:

| material | chars | exact tokens | chars/token |
|---|---|---|---|
| English prose | 12 000 | **2 666** | 4.50 |
| TypeScript source | 11 970 | **2 964** | 4.04 |

So the cap admits **≈2 700–3 000 tokens**, replayed into two windows — close to the ≈3 080 the question
projected, and confirmed rather than assumed. Against a 16 384 ceiling that is ~18 % of each debate
window before one word of argument, on top of the 6 706-token floor the three system prompts already
cost across a five-round debate.

**A note on why the cap is not simply expressed in tokens.** Ollama exposes **no tokenizer endpoint** —
`/api/tokenize` does not exist on `main` (the request, issue #3582, has been open since 2024; PR #12030
is still unmerged). The exact counts this repo relies on are *results* of a completed call, not a
service that can be queried. The only way to get a count before sending is a probe call that really
prefills the text — measured at **4.8–5.4 s for 12 000 characters** on an already-loaded 14b. That is
the full answer to the question raised alongside #28; see [OPEN-QUESTIONS.md](../OPEN-QUESTIONS.md)
**§E-tokenizer**.

## Still open

- **#83 — does the cap count characters before or after `truncateHeadTail`'s marker?** The marker is
  itself characters in the window. Trivial, but it decides whether "12 000" is the budget or the total.
  See [OPEN-QUESTIONS.md](../OPEN-QUESTIONS.md) #83.
