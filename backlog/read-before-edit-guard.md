# Make edit_file refuse a file the model has not read

**Category:** Harness capability

`edit_file` already has the good half of this: `old_string` must match exactly once, or nothing changes
(`src/tools/edit-file.ts`). That is the right rule and it stays.

What is missing is the other half. The tool will edit a file the model has never read, and it has no idea
whether the file changed since the model last saw it. For a model that is more often confidently-wrong
than self-aware — the stated reason the Reviewer is the sole gatekeeper — "look before you write" is a
cheap, mechanical guard against an edit reasoned from a hallucinated file.

What it needs:

- Per-window tracking of which paths were read and their mtime at read time.
- `edit_file` refuses with a recoverable message when the path was never read, or when it changed since.
- The refusal text says **which** of the two cases it is and what to do about it. "Read it first" and
  "it changed under you, read it again" are different instructions, and a model given the wrong one loops.

## Why this shape

From [harness-gaps-vs-claude-code.md](harness-gaps-vs-claude-code.md). Claude Code enforces exactly this
as a hard precondition — `Edit` fails outright if the file was not read in the same conversation — and the
part worth understanding is that it is a **context** mechanism as much as a correctness one.

Once the harness knows what the model has read and when, it can tell the model *not to re-read*. Claude
Code's `Read` description says so in as many words: do not re-read a file you just edited to verify,
because the edit would have errored if it had failed, and the harness tracks file state for you. That
instruction is only safe to give because the tracking exists. Without it the model has no way to know
whether its edit landed, so re-reading to check is the *correct* behavior — and that duplicate read is
one of the two duplicates [evict-stale-tool-results.md](evict-stale-tool-results.md) exists to clean up
after.

So the ordering is: build the tracking here, then the phase prompts under `rules/phases/` can tell the
Worker to stop verifying its own edits, and the eviction policy has less to do.

The staleness half earns its place independently. Two writers touch a project's files during a task — the
model's own tools, and git operations the Reviewer drives — so "the file changed since you read it" is a
real state, not a theoretical one.

## Open decisions

- **What the tracking is keyed to.** A phase window is the obvious scope, but the Worker's window persists
  across five rounds while its stash does not, and a sub-agent's reads should not satisfy its parent's
  guard.
- **Whether `write_file` is gated too.** A full overwrite of an existing file is the most destructive
  operation the model has and the one where a hallucinated file hurts most; but requiring a read before
  creating a *new* file is nonsense, so the rule has to branch on existence.
- **mtime versus content hash.** mtime is free and catches the real cases; it also fires spuriously on a
  git checkout that rewrote a file to identical bytes. A hash is exact and costs a read of the file the
  model is about to edit anyway.
