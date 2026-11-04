# Multi-line input sends the wrong text, misplaces the cursor and never shrinks

**Category:** Terminal UX

Shift+Enter (and Alt+Enter, and Ctrl+J) should put a line break into the message being typed, so one
message can span several lines and Enter sends all of it. `docs/cli.md` (*Composing a multi-line
message*) describes this as working. It does not work reliably yet.

## What exists

**At the idle prompt** — committed in `b179331` and `9f09c39`:

- `bind-newline-key.ts` takes the newline key before readline can submit on it, and `insert-newline.ts`
  splices a real `\n` into readline's edit buffer.
- `enable-keyboard-protocol.ts` asks the terminal to report Shift+Enter as its own key, and
  `translate-legacy-input.ts` turns that report back into the bare LF the rest of the code expects.
- `bind-newline-key.ts` copies the buffer into `pending-submission.ts` when Enter is pressed, before
  readline submits it.

**While a turn runs** — work in progress, committed together with this file so it is not lost, and
unfinished:

- `capture-type-ahead.ts` appends `\n` to the type-ahead buffer on Shift+Enter instead of ignoring it.
- `run-repl.ts` carries that buffer into the prompt with one `insertNewline` per break, so the breaks
  stay real when the turn ends.
- `run-repl.ts` takes the submitted text from `pendingSubmission.line` instead of from what
  `rl.question` returns.
- `run-repl.ts` hides the cursor while a turn runs and shows it again afterwards.

## What the user saw

At the idle prompt **and** in the fenced box while a turn runs:

1. **The wrong text is sent.**
2. **The cursor is in the wrong place.**
3. **The box does not get smaller when text is deleted.**

## What is verified

Driven against the real `node:readline/promises` in terminal mode on Node 24.14.0, with throwaway
scripts that import the real `insertNewline`, `tailToWidth` and `inputFenceRow`:

- **Readline does not return its own buffer.** With `"first\nsecond"` in the buffer, Enter makes
  `rl.question` return `"second\rfirst"` — the lines reversed and joined with `\r`. After ↑ recalls that
  message, the buffer reads `"first\nsecond"` again and Enter returns `"first\rsecond"`. Anything that
  sends the returned string sends the wrong text, which accounts for symptom 1. The likely source is
  readline's history handling; that part was not traced. The work in progress makes the prompt send
  `pendingSubmission.line` — the buffer, copied before readline submits — which should fix symptom 1 at
  the prompt. **That has not been confirmed in a real terminal.**
- **The fenced box cannot show a line break.** It is one reserved row outside the scroll region
  (`input-fence-row.ts`). `inputFenceRow('first\nsecond', 80, 0)` returns a string that still holds the
  `\n`, because `tailToWidth` passes it through. Painting that row moves the cursor down into the pinned
  status rows, which is the smear `input-fence-row.ts`'s header warns about. A work-in-progress comment
  claimed the box "can grow the way the live input does". It cannot, and the comment now says so.

## What is not diagnosed

Symptoms 2 and 3 at the idle prompt. These are leads, and none of them has been checked:

- Readline decides how many rows to move up from its own count (`prevRows`: a row per `\n`, plus
  wrapping). Every refresh also erases to the end of the screen (`ESC[0J`), and the REPL then repaints
  the pinned rows. If those disagree about where the prompt starts, the cursor lands on the wrong row.
- The prompt sits inside the DECSTBM scroll region. Once a growing message reaches the bottom of the
  region, the region scrolls and the top rule moves up into the history. Deleting text afterwards cannot
  move it back down, so the box would look as if it never shrinks.
- The `ask_user` panel's free-text answer is documented as taking the same keys. Check it too.

While this was being debugged, the work in progress logged `key`, `rl.line`, `rl.cursor`, `prevRows`
and `stdout.rows` on every keypress. That logging was removed before the commit, but those fields are
the place to start.

## How to verify

Never by running the app (see `CLAUDE.md`). Reproduce each symptom first by replaying the real readline
and renderer through the terminal-grid emulator harness, then fix it, then show that the same replay
passes. The two readline facts above can be pinned the same way.

## Open decisions

- **The fenced box during a turn.** Grow it to several reserved rows while the text holds a break, or
  keep one row and show the break as a marker (for example `↵`)? Growing changes the reserved rows in
  the middle of a turn, which the constitution allows only if it stays lossless: scroll the region to
  free a row, never paint over one that holds output.
- **The docs.** If a symptom cannot be fixed on some terminal, `docs/cli.md` must say so instead of
  describing the feature as working.
