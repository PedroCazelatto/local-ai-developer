# Framing: the UX/UI comparison against Claude Code

**Category:** Framing note — not a task

This file is **not a task and does not get deleted when work ships.** It is the terminal-UX half of the
comparison whose harness half is in [harness-gaps-vs-claude-code.md](harness-gaps-vs-claude-code.md): what this
product's interface does better than the harness it was built with, where it is behind, and an index of the task
files it produced. Delete it when the last file it indexes is gone.

The same discount applies as to the other note, and harder. Interface design is far more taste than physics, and
"compare X to me" produces a list of ways X should look like me. Two findings below survive that discount because
they follow from the product's own stated goals rather than from the comparison; the rest are opinions with
reasons attached.

## Where this product's UX is ahead — do not trade these away

- **The pinned status region is a product feature, not a user script.** `status-bar.ts` fences three rows (five
  during a turn) with DECSTBM, repaints on every keystroke and on resize, degrades to nothing off a TTY or on a
  terminal too short to give up the rows, and always shows phase, context fill, model and project. Claude Code has
  no persistent status line unless the user writes one.
- **Context fill is exact and that is enforced.** `Ctx: N%` comes from `prompt_eval_count`, and the constitution
  forbids substituting a length estimate anywhere — including here — with `0%` shown rather than `?%` when a phase
  has no completed turn. The harness it was compared to shows an approximation, late. This is the stronger design
  and it matters more here, because the number is a VRAM-safety signal rather than a billing one.
- **The append-only invariant is written down, justified and centralized.** Exactly two things may repaint, the
  pinned rows are outside history by construction, `ESC[2K` only and never `ESC[0J` — with the reason recorded, and
  `run-repl.ts` documenting that readline does exactly that on every line refresh, which is why it repaints after each
  keypress.
- **The model cannot choose a color.** Construct→color lives only in `theme.ts` and the model is told to emit no
  ANSI, so a hallucinated escape cannot fight the palette and a retune is one file.
- **`/help` cannot drift** — generated from the command registry, with an unrecognized group surfaced under "Other"
  rather than silently dropped.
- **`ask_user` beats the equivalent on the skip path.** The tabbed panel restates its keymap every frame because
  the widget is transient, has a Review tab, and — the part with no counterpart — Esc *saves* unanswered questions
  to `/questions`, delivered to the asking phase on its next turn. "I will answer that later, keep going" is a real
  state here and is not one there.
- **The UI is verifiable.** `render-question-panel.ts` is pure — state in, lines out, draws nothing — so its look is
  reviewable in isolation, and the grid-emulator replay harness can drive the real renderer without launching the
  app. One-function-per-file is doing load-bearing work in this layer specifically.

## Where it is behind

In descending order of how much the gap actually costs the user:

1. ~~**No way to stop a turn.**~~ **Shipped.** It was the right first thing and it was physics, not taste.
   Ctrl+C now stops the turn and a second press still quits, both Ollama paths carry an `AbortSignal`,
   `OLLAMA_TIMEOUT_MS` abandons a daemon that has gone silent, a cancelled exchange branches off the phase's
   history so the prompt can be rewritten, and `/stop` · `/stop round` wind a batch down without discarding
   the tasks it finished.
2. **Tool calls are almost opaque** — [show-tool-calls-in-the-scrollback.md](show-tool-calls-in-the-scrollback.md).
   `→ tool: read_file` and nothing else: no path, no result, no diff, during an autonomous no-confirmation loop.
   **Also taste-independent** — the data is already at the call site and in the audit log.
3. **The walk-away loop has no come-back half** — [inspection-commands.md](inspection-commands.md). Already
   recorded. Worth stressing *why* it is not cosmetic: `docs/product.md` states the core loop is "start a batch,
   walk away, come back to a report," and the report currently requires quitting the app and reading JSON. This is
   the product failing its own stated goal, not failing to resemble another tool.
4. **Tab does nothing while the code says it does** — [resolve-dead-tab-completion.md](resolve-dead-tab-completion.md).
   Already recorded. Task ids are long and hand-typed into `/run` and `/answer`.
5. **In-turn progress is a spinner and `round 3/5`** — [in-turn-progress-reporting.md](in-turn-progress-reporting.md).
   New, and deliberately scoped to the reporter side only: the in-window plan half is
   [task-plan-inside-a-task.md](task-plan-inside-a-task.md) and is a much weaker idea. The original comparison
   bundled the two and dismissed both on context grounds; only one of them costs context.
6. **The new-project path is the roughest sequence in the product** —
   [smooth-new-project-onboarding.md](smooth-new-project-onboarding.md). Already recorded.

## Where the difference is deliberate and should stay

- **No mid-turn steering.** The queue is the right fit for an unattended product, and it is already legible:
  `⏳ queued:` and `↩ un-queued:` in the scrollback, so a queued message is never confusable with a dropped one.
  See [steer-a-running-turn.md](steer-a-running-turn.md), which opens by asking whether to build it at all.
- **No confirmation prompts.** Correct for a batch nobody is watching. The missing counterpart is not a permission
  gate, it is the after-the-fact record — item 2 above.
- **No alt-buffer TUI.** It was tried, it blocked copy/paste, it was abandoned. The harness this was compared to
  renders closer to this design than to a full-screen TUI, so this is agreement, not divergence.

## The asymmetry underneath all of it

Claude Code's context is a **budget**: waste costs money and eventually a compaction. Here it is also a **clock**.
Every token resident in a window is re-evaluated by prompt-eval on the next turn of that window, on one 3060 — so
waste compounds across the Worker's five rounds instead of being paid once. That is why the context items in the
other note are worth more here than the tool that suggested them realizes, and it is also why
[evict-stale-tool-results.md](evict-stale-tool-results.md) has to be measured rather than assumed: rewriting
history to reclaim tokens can cost more clock than it saves.
