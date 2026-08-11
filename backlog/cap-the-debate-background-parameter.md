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

## Open decisions

- **What the cap is.** `REVIEW_DIFF_BUDGET`'s 12 000 characters is the nearest precedent for
  model-facing material.
- **Head-only, or head+tail.** `truncateHeadTail` is the repo's default instrument, and unlike the context
  titler's transcript both ends of `background` may matter — it is material, not narrative.
- **Whether a truncated `background` tells the model it was cut.** Every other bounded tool does, through
  `summarizeSearch` and `format-read-notice`. The asymmetry here is that the model wrote this text itself,
  so the notice would be telling it its own input was trimmed.
- **Whether the cap belongs to the tool or the loop.** `debate.ts` validates the argument; `run-debate.ts`
  is what replays it. Capping at the tool bounds it once; capping in the loop bounds what is actually
  re-sent.
