# Framing: the harness comparison against Claude Code

**Category:** Framing note — not a task

This file is **not a task and does not get deleted when work ships.** It holds the parts of the harness
comparison that no single task file owns: how much to trust the exercise, what must not be traded away while
closing the gaps, and an index of the tasks it produced. Delete it when the last file it indexes is gone.

The exercise: compare this orchestrator against Claude Code — the agent harness used to build it — looking only
for differences that are **implementable here**, under this project's real constraints: one local model, one RTX
3060, a hard `num_ctx`, strictly sequential windows, no cloud spend.

The framing matters, because the largest difference is not on the list. Claude Code drives a frontier model with
a very large window; this drives a 14–32b quant in 16k. Nothing here closes that gap. What the list is about is
the principle this repo already half-encodes: **a weaker model needs a tighter harness, not a looser one.**
Several designs here already follow it — the Reviewer as sole committer, `verdictGitConflict` refusing a verdict
the repo disagrees with, exact token counts that are never estimated. The tasks below are the places where this
harness is currently *looser* than the one built for the stronger model, which is backwards.

The UX/UI half of the same comparison is in [ux-gaps-vs-claude-code.md](ux-gaps-vs-claude-code.md).

## Discount this list where it is self-referential

This came from asking one agent harness to compare a second one against itself. That is a structurally suspect
exercise and the tasks should be read with it in mind: the output of "compare X to me" is always going to be a
list of ways X should be more like me.

The parts to trust hardest are the ones that follow from physics rather than taste. Bounding `read_file`, which
has shipped, was right because 16k is 16k, and an unbounded `read_file` is indefensible on any harness at any
model size. Letting `list_files` see a subdirectory, which has also shipped, was right because three phases
genuinely could not enumerate one.

The two to trust least both open with a *decide whether to build this at all* section, and both are cases where
the recommending harness has a very large context window and this one does not:

- [task-plan-inside-a-task.md](task-plan-inside-a-task.md) — an in-task plan helps an agent with room to spare. A
  Worker at 16k may simply lose window to it for no return.
- [steer-a-running-turn.md](steer-a-running-turn.md) — mid-turn steering is arguably against the grain of the
  product. The stated value is "start a batch and walk away"; steering serves someone sitting and watching.
  Cancelling is clearly right. Steering may not be.

More generally: every task below carries an outside reading of this project's intent. The open decisions marked
in each file are the ones that were visible from the code and the docs. The ones that were not visible are exactly
the ones this list will have gotten wrong — so treat these as drafts to correct, not a plan to execute.

## Index, in the order worth shipping

By value per unit of work, not by importance:

1. Bounding and numbering `read_file` — small change, largest single effect. **Shipped.**
2. [evict-stale-tool-results.md](evict-stale-tool-results.md) — medium change, comparable effect. Read its
   KV-cache caveat before committing to the design; it is the one cost the original comparison missed.
3. Letting `list_files` see a subdirectory — small, large. **Shipped**, together with its pair, the
   `search_in_files` context lines and cheaper modes.
4. A small-model lane for the one-shots — **closed, not shipped** (OPEN-QUESTIONS.md #90). Its pair, the
   per-window `num_ctx` task, shipped. This half was dropped once the project's optimization target was
   stated: *precision and accuracy over time taken*, with the acceptance test *the output must be better;
   time is irrelevant*. Every argument for the lane was a time-and-residency argument, and a 1.5–3b model
   does not write better titles, commit messages or summaries than the session model.
5. Refusing to write a file the window has not read — small, medium. **Shipped**, and wider than the entry
   asked for: `write_file` is gated too, branching on existence, because a full overwrite of an existing
   file is the most destructive thing the model can do and was the least guarded. The phase prompts now
   tell the Worker not to re-read its own edits.

Worthwhile but not urgent: [glob-files-by-path.md](glob-files-by-path.md),
[surface-matching-standards.md](surface-matching-standards.md),
[structured-subagent-results.md](structured-subagent-results.md).

Found during the same pass but not parity gaps: [record-attempted-tasks.md](record-attempted-tasks.md) (a defect
in the execution loop), and the verification argument now folded into
[test-the-invariant-functions.md](test-the-invariant-functions.md).

Blocked on a decision before any code: [background-long-running-commands.md](background-long-running-commands.md)
(the no-parallelism non-goal), plus the two low-confidence items named above.

## What must not be traded away

Recorded here because several tasks touch these paths, and they are the things this harness does *better* than the
one it was compared to:

- **Per-phase tool allowlists as data**, fail-loud on an unknown name, with the prompt's `# Your Tools` block
  generated from the very array sent to Ollama. Any new tool must be added to the arrays that should hold it — and
  only those.
- **`verdictGitConflict`** — the model's verdict is refused when the repo disagrees. Nothing may give a phase a way
  around it.
- **Exact token counts**, with a null propagated as null rather than coerced to zero. Eviction and budgeting both
  touch token accounting; neither may introduce an estimate.
- **The Retro loop**, and the rule that a `rules/` edit is never auto-committed.
- **The audit log**, written from the single dispatch choke point. New tools log through it like every other tool;
  none writes its own row.
- **The Worker's persistent window across the fix loop.**
  [evict-stale-tool-results.md](evict-stale-tool-results.md) exists to make it affordable, not to shorten it.
