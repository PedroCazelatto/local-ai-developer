# Measure the debate windows before giving them a smaller ceiling

**Category:** Memory / context

Re-filed from backlog item 8 by its own decision (OPEN-QUESTIONS.md #34a: *"ship the cap; re-file the
ceiling with a measurement"*).

## Where things stand

Every model call names a role, and the role decides the `num_ctx` it is sent under
(`src/core/llm/resolve-window-ctx.ts`). Three throwaway one-shots — the context titler, `search_rules`
and the commit-message writer — run at **half** the base ceiling (8 192 at the default 16 384), because
at that size the model was measured fully resident in VRAM on the RTX 3060 while at 16 384 part of it
spills to the CPU. What qualifies a role for that group is **an input with a known hard maximum**.

The two debate roles, `debate-turn` and `debate-digest`, stay at the full base. Until item 8 the stated
reason was that `debate`'s `background` was uncapped. **Item 8 capped it** (3/16 of the base, cut head +
tail at the tool's entry gate), so that reason is gone — but a second one remains: each debate window
**grows a turn every round**, for up to five rounds, so its input has no fixed maximum the way a commit
diff does. The comments in `resolve-window-ctx.ts` and `debate-deps.type.ts` now say this.

## What to do

**Measure, then decide.** Run real debates with a full-size `background` and record the peak exact
`prompt_eval_count` each of the three windows reaches (challenger, proponent, digest) across five rounds.
The debate's exact cost already reaches the audit row as `debatePromptTokens`, but that is a **sum**
across calls, not the peak of any one window, so the measurement needs per-call figures.

- If the measured peak sits comfortably inside half the base, the roles can join the bounded group — a
  one-line edit per role in `resolve-window-ctx.ts`.
- If not, record the measurement here and close the question in the other direction (#34c was the option
  to drop it permanently).

## Related

Backlog item 9 gives every spawned window, the debate pair included, a summarization failsafe. That is a
different instrument for the same growth: it would bound how large a debate window can get, which may
change what this measurement needs to show. Read item 9's outcome before measuring.
