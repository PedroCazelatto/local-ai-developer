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

## What it optimizes for

**Precision and accuracy, not time taken.** The model running here is already far weaker than a cloud
one, so spending its capacity to go faster spends the wrong thing. A change that makes a phase quicker
but its output worse is a regression, and generation speed is not a reason to give a window less room:
that is why `OLLAMA_NUM_CTX` stayed at 16 384 after the benchmark measured 16 384 costing 29 % of
generation throughput on a 14b against 12 288 — the extra 4 096 tokens of working room is worth more
than the seconds.

**The one real bottleneck is VRAM, and the rule is about weights.**

> Spill is acceptable while the **weights** stay resident and only **KV cache** offloads.

Weights on the CPU means every token of every layer crosses the bus; KV cache on the CPU costs only the
attention reads. The distinction is what separates a model that is merely slower from one that should
not be used at all, and it is measurable per model: `/api/ps` reports `size` and `size_vram`, and
`size_vram < size` is the spill. On the 12 GB card this repo is built for, VRAM tops out at 10.2–10.7 GB
and only a ~9 GB model keeps its weights resident.

Nothing is ever pinned to the CPU deliberately. A model whose weights will not fit is **marked in the
model list, not refused** — a slow model is the user's choice to make; an unusable one is not.

**One sub-agent at a time.** The non-goal below is about phases; this is the same reasoning one level
down. There is no VRAM for a second concurrent window, so a `Subagents: N` count would never exceed one
and is not built.

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

**Every tool call leaves a two-line record in the scrollback.** `→ read_file src/core/ui/theme.ts`
before the call, naming it by the one argument that says what it did — the path, the command, the
search pattern, never a dump of the arguments object — and `← 340 lines` after it returns. A failed
call is red and says why, so a refused `edit_file` never reads like a successful one. `write_file` and
`edit_file` add a compact +/- diff under their result line, which collapses to `+12 −3` with the path
above 20 changed lines or 2,000 characters, because the scaffold written into a new project would
otherwise flood the buffer. A sub-agent's calls are indented under the parent call they happened
inside and marked `[sub:01JQ]`.

This is a **record, not a confirmation prompt** — tools still run autonomously, with nothing to
approve (see [constitution.md](../constitution.md)). The analogue is showing the diff after the fact,
which is what makes an autonomous edit reviewable at a glance. Both lines are static the moment they
are written: history, never a widget.

> A path in these lines is **never truncated** — a row that does not fit wraps instead. Nothing
> measures these rows and they move the cursor only by newline, so a wrapped row costs a row and
> nothing else; a cut path would cost the file name, which is the part that identifies it. Everything
> that is not a path — commands, search patterns, prose — is truncated to the width as usual.

**The input box stays on screen while a turn runs.** Its rule, the `›` row, and the rule below it are
rows reserved at the bottom of the terminal, so the reply streams above them and never disturbs them.
Typing during a turn goes into that row rather than echoing into the reply.

**Enter queues that message instead of sending it**, and the queue runs in order the moment the turn
finishes — each message exactly as if it had been typed at the prompt. Queueing is announced in the
scrollback as it happens, so a queued message never looks like a dropped one, and **↑** takes the
newest one back into the row to edit. Whatever is typed but not queued moves into the real prompt when
the turn ends.

> The binding terminal-UX invariants (append-only scrollback, never take the alt-buffer, `ESC[2K`
> only, theme owns every color) are in [constitution.md](../constitution.md).
