# Make phase contexts addressable, titled records

**Category:** Memory / context

A phase context becomes a first-class record — `{ id, phase, messageHistory, title }` — so a context
can be listed, described, and reopened by name instead of existing only as a file on disk.

The **title** is what makes the record useful: it must describe *the reason that context exists*, not
merely its first message. `switch_phase` (see [switch-phase-tool.md](switch-phase-tool.md)) asks the
model to choose between opening a fresh context and resuming an old one, and the title is the only
thing it has to choose on.

## Title generation

- Written by a **clean model context** — a throwaway one-shot, the same device
  `composeCommitMessage` and `search_rules` already use, so it costs the working phase no context.
- Its input is the **messageHistory** plus a small starter context holding the rules for writing a
  title.
- Generated **after the first agent response** in that context.

## Storage

One row per context in a manifest at `.orchestrator/memory/phases.jsonl`.

Known trade-off, accepted: the manifest is a second source of truth and can drift from the files it
describes — a `/clear`, a `/resume` swap, or a file deleted by hand leaves an orphan row. Whoever
builds this handles the drift rather than assuming the two stay in step.

## Where this starts from

Archived histories today are `<phase>-<ts>-<n>.jsonl` files under `.orchestrator/memory/archive/`,
listed by `listArchives` (`src/core/session/memory-store.ts`) as `{ file, archivedAtMs, turnCount,
firstUser, lastUser, totalTokens }` — derived straight from the JSONL with no model call. There is no
id and no title, and `firstUser` is a raw first message, not a description.
