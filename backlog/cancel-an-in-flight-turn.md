# Let the user cancel an in-flight turn without killing the session

**Category:** Terminal UX

There is currently no way to stop a turn. `capture-type-ahead.ts` deliberately forwards Ctrl+C to the
suspended readline listeners so it "still ends the session mid-turn", and the Ollama call carries no
`AbortSignal` and no timeout (`OllamaClient.chat` / `OllamaClient.stream`). So when the model heads
down a wrong path, the only exit is killing the process — which loses the turn still in flight
(buffered, not yet flushed) and the whole session with it.

On a 3060 a 14–32b model takes minutes per turn, and a batch is that multiplied by tasks × rounds ×
two windows. This is the one failure mode with no recovery, which is what makes it the first thing to
fix.

What it needs:

- An `AbortSignal` threaded into `ollama.chat` (both the streaming and non-streaming paths), so an
  aborted request tears down cleanly the way `pullModel` already does for `/models pull`.
- A cancel key that unwinds to the prompt instead of ending the session. The partial assistant turn
  should still be stored — a cancelled turn is history, not a hole.
- A second press (or Ctrl+C) still exits, so the escape hatch never disappears.
- A per-call timeout, so an unreachable or wedged daemon surfaces as a recoverable line rather than a
  REPL that hangs forever.
- The batch equivalent: "stop after this round" and "stop after this task", so an overnight run can be
  wound down without discarding the tasks it already finished.

## Open decisions

- **Which key.** Esc is free during a turn; Ctrl+C is what people reach for but currently means "quit".
  A first-press-cancels / second-press-exits scheme covers both, at the cost of making Ctrl+C
  ambiguous.
- **What a cancelled turn records** — the partial text alone, or a marker saying the user cancelled so
  the model reads its own truncated turn correctly on the next replay.
