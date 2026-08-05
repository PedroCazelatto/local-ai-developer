# Make a sub-agent declare its response shape at spawn

**Category:** Harness capability

`ask_subagent` returns free text into the parent's window, so the parent has to re-read and interpret it,
and a rambling sub-agent bills its parent for the rambling.

The machinery for the better version already exists twice over: `submit_verdict` and `submit_retro` are
phase-scoped tools that capture a typed terminal result, and `debate` returns a four-field digest.
Generalizing that — a required response shape declared at spawn — makes sub-agent answers parseable instead
of prose, and bounds what one can cost.

## Why this shape

From [harness-gaps-vs-claude-code.md](harness-gaps-vs-claude-code.md). A sub-agent is the strongest context
mechanism either harness has, and it is worth being explicit about why, because the framing changes what
this task is for.

In Claude Code, delegating a search is not primarily about parallelism — windows here run strictly one at a
time and the mechanism still pays off. It is a **context firewall**. The sub-agent reads twenty files in its
own window and returns four sentences; the parent pays for the four sentences. The tool description for its
read-only search agent says exactly that it reads excerpts rather than whole files and returns the
conclusion, not the file dumps, and the orchestrating model is told the agent's report is a *return value*,
not a message — so it comes back as data.

`ask_subagent` already has the isolation. What it lacks is the bound: nothing stops the digest from being as
long as the investigation. The typed shape is what turns "it ran in another window" into "it cost the parent
a known amount", and this repo already applied that principle once, deliberately, in `debate` — "the caller
pays for the digest, not the argument."

The second-order effect is worth naming too. A sub-agent that must fill named fields is a sub-agent that
knows what it was asked for, which is a meaningful accuracy gain on a small model. `submit_verdict` is
already evidence of that in this codebase.

## Open decisions

- **Who declares the shape — the caller or the tool.** A parent phase choosing fields per call is flexible
  and puts schema authorship in a small model's hands. A fixed set of named shapes (`findings`, `answer`,
  `file-list`) is less expressive and far more predictable, and matches how `submit_verdict` already works.
- **What happens when the sub-agent will not comply.** Retry, coerce, or return a failure to the parent.
  Silently handing the parent malformed prose is the one option that is clearly wrong — the whole point is
  that the parent can trust the shape.
- **Whether this replaces free-text sub-agents or joins them.** Some questions genuinely want prose. If both
  exist, a small model has to choose, and it will choose wrongly some of the time.
