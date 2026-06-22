> **Status:** ⬜ Not started

# 05 — Persistent REPL UI baseline

**Version:** Foundation
**Depends on:** 02 (config: project · model · numCtx · phase), 03 (streamed deltas + exact tokens to display)
**Blocks:** 06 (the orchestrator drives this UI to render turns and dispatch `/swap` / `/exit`)

## Why

CLAUDE.md prioritizes **user experience in the terminal**. The old Python UI was a full-screen Rich `Live` TUI that takes over the alt-buffer and clears the screen — the user has stated they **can't copy/paste from it** (auto-memory: "verify via scripted live checks"). The pivot decision is therefore a **persistent REPL that preserves scrollback**: it prints incrementally to the normal terminal buffer, never clears the screen or grabs the alt-buffer. This task builds that baseline UI plus the `@clack/prompts` / `chalk` / `ora` integration, and wires `/swap` and `/exit`.

## Behavior

A persistent, scrollback-preserving REPL. **No alt-buffer, no full-screen takeover, no screen clears.** Output is appended to the terminal like a normal program; the user can scroll up with their terminal and copy text freely.

### What the user sees

1. **A banner line on boot**, e.g. `Local AI Developer  ·  /swap <phase>  ·  /exit` (ports the old `add_system_message` banner).
2. **A prompt** for input each turn. Use a simple readline-style line reader (Node `readline` / `readline/promises`) **or** `@clack/prompts` `text()` for the free-text turn input — pick whichever preserves scrollback and lets the user paste. (`@clack/prompts` is required for the **discrete** prompts below; for the streaming chat line, a plain `readline` interface that prints inline is simplest and most paste-friendly.)
3. **Streamed assistant output rendered incrementally** — as the orchestrator yields filtered deltas (from task 03), write each delta to stdout immediately (`process.stdout.write(delta)`) so text appears token-by-token, **without** redrawing or clearing. When the turn ends, print a newline. The assistant block is visually attributed to the active phase (e.g. a `chalk`-colored `discovery ›` prefix).
4. **A status line** showing: `project · active phase · model · exact tokens · num_ctx`. Because we don't own a fixed region of the screen, render it as a printed line after each turn (and/or just before the next prompt) rather than a pinned panel. Tokens come from task 03's exact counts; if a count is `null`, show `?` (or `n/a`) — **never a fabricated number**.
5. **System messages** like `→ tool: <name>` printed inline when the orchestrator dispatches a tool (ports `ui.add_system_message(f"→ tool: {name}")`), `chalk`-dimmed so they read as meta.
6. **An `ora` spinner while the model is "thinking"** — start the spinner after the user submits and before the first delta arrives; stop it the moment the first visible delta streams in (so the spinner never overlaps streamed text).
7. **`@clack/prompts` for discrete choices** — confirmations and batch selection (e.g. later: "run one / some / all tasks"). For Foundation, wire the primitives (`confirm`, `select`, `text`) into a small UI module so 06 and V1 can call them; an actual confirmation use-site isn't required yet.

### Theme

A `chalk`-based theme module: one place that defines the colors for phase prefix, system/meta lines, status line, errors. No raw color codes scattered around. Keep it small.

### Commands wired here

- **`/swap <phase>`** — calls back into the orchestrator (06) to switch the active phase; on success the status line's phase + the assistant prefix update. On unknown phase, print a recoverable error line listing available phases (don't crash).
- **`/exit`** — clean shutdown: stop any spinner, restore the cursor, let `run.ps1`'s `finally` stop Docker. Exit the process cleanly.
- Input starting with `/` is a **command**; anything else is a **chat message** sent to the orchestrator. (Ports `_make_handler`'s `first.startswith("/")` branch.)

### Explicitly NOT in this task

- **Shift+Tab phase-cycle** and **`/help`** are **V5** (ROADMAP V5 "status line + /help + discoverability"). Do not build them here. `/swap` is the only phase-switch mechanism in Foundation.
- No `/clear`, `/resume`, `/models` — those are V4/V5.

## Files

- `src/core/ui/theme.ts` — `chalk` color palette (phase prefix, meta, status, error).
- `src/core/ui/renderer.ts` — print helpers: `streamDelta(text)`, `systemMessage(text)` (`→ tool: …`), `statusLine({project, phase, model, tokens, numCtx})`, `assistantPrefix(phase)`, `banner()`. All append-only writes; never clear.
- `src/core/ui/spinner.ts` — thin `ora` wrapper: `startThinking()` / `stopThinking()`.
- `src/core/ui/prompts.ts` — thin `@clack/prompts` wrappers: `confirm`, `select`, `textInput` for discrete choices.
- `src/interface/repl.ts` — the REPL loop: read a line, classify command vs message, call the orchestrator, drive the renderer/spinner, handle `/swap` and `/exit`.

## Notes / pitfalls

- **Preserve scrollback — this is the whole point of the rewrite.** Do **not** use the alt-screen buffer, `console.clear()`, ANSI clear-screen, or a library that owns a fixed screen region (the old Rich `Live(screen=True)` is exactly what we're replacing). Write incrementally to the normal buffer so the user can scroll and copy.
- **Tokens are exact or `?` — never invented.** Display the value task 03 reports; if it's `null`, show a placeholder, not a guess. (CLAUDE.md token rule.)
- **Spinner vs. stream collision.** `ora` writes to the same TTY; stop the spinner before writing the first streamed delta or the spinner frame will interleave with model text. Stop it on first delta, not at turn end.
- **Don't block the loop on Docker/model.** Streaming is async (`for await`); keep the input read and the spinner responsive.
- Keep the renderer dumb (pure printing). Turn-loop logic, tool dispatch, and history live in 06 — the UI only displays and collects input.
- Errors from a command (`/swap badphase`) print a recoverable line; they never throw out of the REPL.

## Acceptance

- `.\run.ps1 start hello-world` opens a **persistent** REPL: the boot banner prints, a prompt waits for input, and scrolling up in the terminal still shows earlier output (scrollback intact — no full-screen takeover).
- Typing a message shows an `ora` spinner, then streamed assistant text appears **incrementally** (token-by-token), then a newline, then a status line reading `hello-world · discovery · qwen2.5-coder:14b · <exact tokens> · 16384`.
- The displayed token count matches the exact `prompt_eval_count + eval_count` from the turn (task 03); a turn missing a count shows `?`, not `0`.
- When the orchestrator dispatches a tool, a dimmed `→ tool: <name>` line prints inline (no screen clear).
- `/swap design` updates the status line's phase and the assistant prefix to `design`; `/swap nonsense` prints a recoverable "unknown phase, available: …" line and the REPL keeps running.
- `/exit` stops cleanly; the user can select and copy any prior line of the session from their terminal.
- Shift+Tab and `/help` are absent (correctly deferred to V5).
