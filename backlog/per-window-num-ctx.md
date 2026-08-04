# Give each window its own num_ctx

**Category:** Memory / context

`OLLAMA_NUM_CTX` is one global number serving every window: the interactive planning phases, the
Worker, the Reviewer, sub-agents, and the throwaway one-shots (`search_rules`, `composeCommitMessage`,
the context titler, the summarizer) alike. They do not want the same thing.

The system prompt is roughly 2–2.5k tokens before any history — the phase file, the generated
`# Your Tools` block, and the tool-use plus output-format blocks in `system-prompt.ts`. At the default
16384 that is about 15% of the window gone before the Worker reads its first file, and the Worker is
the one window that genuinely needs room: it holds every prior attempt and the Reviewer's feedback
across up to five rounds, by design. Meanwhile the context titler gets the same 16k to produce one
line of at most 60 characters.

Raising the global value is not a free fix. Every phase context records the ceiling it was written
under, and a context written under a different one is neither listed nor reopenable — deliberately, so
a history built for a larger window is never replayed into a smaller one. So today "I want more room
for this task" costs the user every context they have.

What it needs:

- A per-window ceiling, resolved from the window's role rather than a single env var. VRAM is the
  binding constraint and windows run strictly one at a time, so this is a scheduling question, not a
  capacity one.
- The persistence rule kept intact: a phase **context** still records the ceiling it was written under
  and is still hidden if that changes. Only the interactive phases persist contexts at all, so the
  spawned windows and one-shots can vary freely with no effect on what is reopenable.
- The one-shots dropped to something small. They are stateless by construction and their whole purpose
  is to cost the calling phase nothing.

## Open decisions

- **Where the per-window values come from** — separate env vars, a small table in code keyed by window
  role, or a ratio of the base `OLLAMA_NUM_CTX`.
- **Whether the interactive phases stay pinned to one shared ceiling.** They are the only windows whose
  history persists, so letting them differ from each other means Discovery and Design could hide each
  other's contexts on a change. Keeping them together is probably right, but it is a decision.
- Whether the system-prompt overhead itself is worth attacking separately — the two guidance blocks are
  identical on every turn of every window and are re-sent each call.
