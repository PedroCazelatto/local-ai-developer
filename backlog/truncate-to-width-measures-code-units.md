# `truncateToWidth` measures code units, not columns

**Category:** Terminal UX

`src/core/ui/truncate-to-width.ts` promises columns and counts UTF-16 code units. Its header says
*"Cut a PLAIN (unstyled) string to at most `width` columns"*, its JSDoc repeats "columns", and its body
uses `text.length` and `text.slice`. It is the **only** member of the width layer that does not go
through `visibleWidth` / `codePointWidth` — the two functions that exist precisely to answer "how many
columns is this".

Found by backlog item 2 while pinning the width layer, and pinned there as *current* behaviour with a
comment saying so. **The test asserts the bug.** Fixing this means changing that test, and that is the
intended shape: the test records what the function does today so that a change to it is deliberate and
visible.

## Two defects, one cause

**A wide glyph is counted as one column.** `truncateToWidth('日本語', 3)` returns the string unchanged,
because `'日本語'.length === 3`. It occupies **6** columns. The function reports success and hands back
a string twice as wide as the budget it was given.

**An astral code point is cut in half.** `truncateToWidth('😀ab', 2)` returns a **lone high surrogate**
followed by the ellipsis. The header already warns that a cut must not land inside an ANSI escape
sequence; the identical hazard one line away — a cut landing between the two halves of a surrogate pair
— is unguarded.

## Why this is worse than a formatting nit

**Correction to this file's first draft, which said the function had a single caller.** It never did.
At `f08c47c` **six** files called it; after backlog item 1's `core/ui` sweep **eleven** do:
`format-tool-call-line.ts`, `format-tool-result-lines.ts`, `input-fence-row.ts`,
`write-question-transcript.ts`, the six `panel-*.ts` row builders, and
`interface/commands/write-fitted-line.ts`. Two further files name it in a comment without calling it —
`tail-to-width.ts`, whose header explains why it is *not* this function, and `tool-call-subject.ts`.

**The sweep did not widen the blast radius; it made it visible.** The proof is that the number of call
sites did not move: **16 before, 16 after.** Only their distribution changed —
`render-question-panel.ts`'s eight calls became the six `panel-*.ts` builders, and `ask-questions.ts`'s
three became `write-question-transcript.ts`. **Scope the fix against 16 call sites across 11 files, not
against one.**

The sharpest symptom is still the question panel, and it is worth stating exactly. The six `panel-*.ts`
row builders feed a panel that **redraws by moving the cursor up by its own line count**. The contract
it needs is exactly one terminal row per logical line. When a row comes back wider than its budget the
terminal wraps it, the panel's idea of its own height is short by one, and the redraw moves the cursor
to the wrong row — smearing the panel down the screen on every repaint.

But every other caller has its own version of the same failure. `format-tool-call-line.ts` and
`format-tool-result-lines.ts` feed the scrollback, where an over-wide row costs an unwanted wrap rather
than a corrupted redraw; `input-fence-row.ts` feeds the pinned rows, where it is as bad as the panel.

So the function's purpose is to prevent a specific class of rendering failure, and for CJK, emoji and
every other wide glyph it does not prevent it. `docs/product.md`'s OS-agnostic reach makes this
reachable in normal use, not a curiosity: any of these paths quoting a path, a task title or the
model's own prose in a non-Latin script hits it.

## The shape of a fix

Route it through the layer that already exists. `visibleWidth` and `codePointWidth` are tested (item 2
pinned 53 cases across the four width functions, including every range boundary of the wcwidth table
and the code point either side), so the machinery to do this correctly is present and proven — this
function simply does not call it.

Iterate by code point rather than by code unit, accumulate `codePointWidth`, and stop before the
budget is exceeded. That fixes both defects at once: a surrogate pair is one code point and cannot be
split, and a wide glyph costs the 2 columns it actually occupies.

## Decisions, all open

- **What happens when the ellipsis itself does not fit?** The budget can be smaller than the ellipsis,
  and it can land such that appending the ellipsis re-crosses the limit. Today's code has no answer
  because it never measures.
- **Does a zero-width or combining mark trail along with its base character?** `codePointWidth`
  explicitly declares combining marks and ZWJ out of scope and counts them as 1, which item 2 pinned
  and did not treat as a defect. A truncation that splits a base character from its combining mark is
  a new question this fix has to answer or explicitly decline.
- **Does the fix change the signature?** Callers pass a column budget today and will keep doing so;
  nothing suggests it needs to change, but it is worth stating rather than assuming.

## Two neighbours that are not defects

Recorded so a later reader does not re-find them and file them again. `visibleWidth` strips CSI
sequences but not OSC — latent only, because nothing in `src/` emits OSC today. And the width layer
counts combining marks and ZWJ sequences at one column each, which `code-point-width.ts` declares out
of scope in its own header.

## Why it sits where it does

It is small, it is well understood, and the tests that will have to change are already written. It was
deliberately **not** folded into backlog item 1's sweep of `src/core/ui/` — that sweep was a
no-behaviour-change refactor, and a live rendering fix buried inside a 77-declaration mechanical diff
is a fix nobody can review.

**That sweep has since landed (`4daa490`, `1c3b1cb`), so the blocker is gone and the ground is now
better than it was.** The panel's per-row truncation budgets — `width-1`, `width-4`, `width-5`,
`width-7` — used to sit inside one 130-line file; they now sit one per file beside the row each belongs
to, with `panel-indent.ts` pinning the margin they are all derived from. So "does this row still fit
once truncation starts costing 2 columns for a wide glyph" becomes a per-file review rather than a
whole-file read. `truncate-to-width.ts` itself was carried across untouched.
