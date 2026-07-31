# Product

What this project is, who it is for, and where its boundaries are.

## What it is

A **TypeScript/Node CLI** that orchestrates a **locally-run** Ollama model to autonomously develop
code projects. Goals:

- Learn prompt engineering, AI interaction isolation, and planning by building the orchestrator by hand.
- Practice planning skills by driving the interactive planning phases and reviewing execution output.
- Run everything on a local RTX 3060 — no cloud spend.
- Ship this repo as a public learning artifact, used only by the author.

## Non-goals

- Not a VSCode/Cursor replacement.
- Not a "vibe coding" tool.
- No backend/frontend deployment for the orchestrator itself.
- No multi-user support.
- **No parallelism.** Phases run **one at a time**, sequentially. The way to scale is to start a
  batch and let it run unattended (e.g. overnight), not to run windows concurrently — a 3060's VRAM
  would not comfortably hold parallel slots anyway.

## Platform reach

The orchestrator is **OS-agnostic**: it runs on Windows, macOS, and Linux from a single Node
entrypoint (`scripts/run.mjs`), and `src/` carries no OS-specific assumptions — paths go through
`path`/`os.homedir()`, and both line endings are handled. Windows is the primary test bed.

## Terminal output

The model's replies are **rendered as markdown, live**: each delta prints raw the instant it arrives
(a local model is slow enough that token-by-token *is* the feedback), and each line is repainted
formatted the moment its newline lands — markdown is only decidable once a line is complete. The
system prompt tells the model its markdown is really rendered, so it has a reason to emit it.

**The model writes plain markdown and never names a color.** The construct→color mapping lives in the
orchestrator's theme, so the palette is retuned in one place and a model that hallucinated a color
cannot fight it. The model is told explicitly to emit no ANSI escapes.

This does not weaken the scrollback invariant. Only the **in-progress** line is ever rewritten — it is
still under the cursor and has not scrolled away — and transient widgets (the `ask_user` panel, the
spinner) repaint only their own frame and then collapse into one static, copyable summary. Finished
history is append-only, forever.

**The input box stays on screen while a turn runs.** Its rule, the `›` row, and the rule below it are
rows reserved at the bottom of the terminal, so the reply streams above them and never disturbs them.
Typing during a turn goes into that row rather than echoing into the reply, and it is held there:
**Enter does not send mid-turn** — the text moves into the real prompt, editable, the moment the turn
ends. (Submitting while the model works is queueing, which is its own pending task.)

> The binding terminal-UX invariants (append-only scrollback, never take the alt-buffer, `ESC[2K`
> only, theme owns every color) are in [constitution.md](../constitution.md).
