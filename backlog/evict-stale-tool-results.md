# Evict stale tool results from a live window

**Category:** Memory / context

Every tool result stays verbatim in the phase's message array until the summarization failsafe fires at
`SUMMARIZATION_THRESHOLD_RATIO` and rewrites the history wholesale. There is nothing between "keep it
all" and "summarize everything."

An eviction policy is the missing middle: keep the last N tool results in full, and replace older ones
with a one-line stub naming the call and what it returned (`read_file src/foo.ts → 340 lines,
superseded`). It is more surgical than summarization, it costs no inference at all, and it is
reversible in the sense that the durable record still holds everything — the eviction hides turns from
the live view exactly the way the memory model already describes for summaries.

It matters most for the Worker, whose window persists across all five rounds by design. That design is
load-bearing and must not be traded away to save context — evicting stale *tool output* is precisely
how to keep it affordable.

**The cheapest possible subset ships on its own.** Nothing dedupes reads today: a file read in round 1
and again in round 3 occupies the window twice, and the first copy may be stale on top of that. Evicting
*superseded reads of the same path* needs no policy, no N, and no judgement — the newer read is simply
authoritative. Do this first; the general policy is the same code path with a rule attached.

## Why this shape

From [harness-gaps-vs-claude-code.md](harness-gaps-vs-claude-code.md). Claude Code reaches the same end
by a different route, and the difference is instructive:

- **It mostly prevents the duplicate instead of evicting it.** `Edit` cannot run unless the file was
  read in the same conversation, the harness tracks file state from that point, and the model is told
  outright not to re-read a file it just edited to verify, because a failed edit would have errored. The
  duplicate read is designed out at the point of the call. That half of the idea has **shipped** — both
  write tools refuse a file the window has not read, and `rules/phases/` now tells the Worker, Design and
  Retro not to read a file back to verify their own edit. So one of the two duplicates this task exists
  to clean up after should already be gone; measure what is left before designing for it.
- **What it cannot prevent, it summarizes *partially*.** Its compaction hands forward a summary
  **plus whatever context did not need summarizing** — the recent turns survive verbatim. The failsafe
  here rewrites the history as one artifact, which is the blunter instrument. Partial is the shape to
  aim for: stub the old, keep the recent untouched.

## The cost this trades against — measure it before believing the win

The gap list did not mention this and it may be the deciding factor. Ollama reuses the KV cache for a
**common prefix** between consecutive calls on the same model. Appending to a message array preserves
that prefix; **rewriting an earlier message destroys it from the edit point onward**, and everything
after has to be prompt-evaluated again.

So eviction is not free the way it is on a hosted API. On a 3060 a 32b quant re-evaluating 10k tokens of
prefix is measured in seconds to tens of seconds, and it happens on *every* subsequent turn of that
window. Evicting a 3k-token read to save 3k tokens can cost more wall clock than it saves — and the same
objection applies to the existing summarization failsafe, which already rewrites everything.

What that implies for the design:

- **Evict in batches, not continuously.** One rewrite that reclaims a lot beats five that each reclaim a
  little, because the prefix is paid for once either way.
- **Evict from as late in the history as possible.** The earliest message you touch sets how much has to
  be re-evaluated; a stub written at message 4 is far more expensive than the same stub at message 20.
- **Verify the premise first.** Confirm empirically how Ollama behaves on a changed prefix at this
  project's settings before building around either assumption. A throwaway script driving two `chat`
  calls — identical prefix, then a mutated one — and comparing the reported `prompt_eval_count` and
  duration answers it in minutes.

## Open decisions

- **N, and whether it counts calls or tokens.** "Last 3 tool results" is predictable; "the last 4k
  tokens of tool output" tracks the actual constraint.
- **Whether a stub is ever re-expanded.** The durable record still holds the full result, so a
  `reopen_tool_result` is possible. It is probably not worth it — but if it is never possible, the stub
  text must be good enough to act on, which raises the bar on what it says.
- **Whether eviction and the summarization failsafe share a trigger.** They compete: an eviction pass
  that drops the window below the ratio postpones summarization indefinitely, which may be exactly right
  or may hide a window that genuinely needs compacting.
