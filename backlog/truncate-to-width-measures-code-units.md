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

`truncateToWidth`'s sole caller is `render-question-panel.ts`, and that panel **redraws by moving the
cursor up by its own line count**. The contract it needs is exactly one terminal row per logical line.
When a line comes back wider than the budget, the terminal wraps it, the panel's idea of its own height
is now short by one, and the redraw moves the cursor to the wrong row — smearing the panel down the
screen on every repaint.

So the function's purpose is to prevent a specific rendering failure, and for CJK, emoji and every
other wide glyph it does not prevent it. `docs/product.md`'s OS-agnostic reach makes this reachable in
normal use, not a curiosity: a question panel quoting a path, a task title or a model's own prose in
any non-Latin script hits it.

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

It is small, it is well understood, and the tests that will have to change are already written. It is
**not** folded into backlog item 1's sweep of `src/core/ui/`: that sweep is a no-behaviour-change
refactor, and a live rendering fix buried inside a 77-declaration mechanical diff is a fix nobody can
review. Land the sweep first, then this against the settled file.
