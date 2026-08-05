# Run the throwaway one-shots on a small model

**Category:** Memory / context

`oneShot` runs against the session model. So a 32b model is loaded to write a 60-character context
title, a commit message, a `search_rules` match, and every summarization.

The `debate` loop makes this materially more expensive than it was: a five-round debate is roughly a dozen
one-shot calls — challenger, proponent, and the digest — all on the session model, and it is meant to be
used routinely before an expensive decision.

`docs/open-questions.md` already lists "Throwaway-context model" as undecided. The recommendation from the
comparison is to **split it**: a 1–3b model handles titling, commit messages, rule matching and
summarization adequately, and on a 3060 the VRAM and latency saving per session is large.

This is the sibling of [per-window-num-ctx.md](per-window-num-ctx.md) — that task gives each window its
own ceiling, this one gives some of them a different model. They touch the same resolution point and are
probably best built together.

## Why this shape

From [harness-gaps-vs-claude-code.md](harness-gaps-vs-claude-code.md). The principle Claude Code applies
here is **tier the model to the job, and let the cheap tier absorb the volume.** Its sub-agents and
scripted fan-outs take a per-call model override precisely so a mechanical stage — labelling, matching,
extracting — does not run on the tier reserved for judgement, and the default when no override is given is
to inherit rather than to guess.

Two consequences of that design are worth copying:

- **The default is inheritance, not a hard-coded name.** Same reasoning the boot-model resolution in
  `resolve-boot-model.ts` already follows: a model name compiled in says nothing about what is installed.
- **Which stages get the cheap tier is a per-call decision, not a global setting.** Titling and commit
  messages are obviously mechanical. Summarization is not obviously either way — it decides what a phase
  remembers.

## Open decisions

Carried over, plus one the comparison surfaced:

- **Whether the debate windows count as throwaway.** The digest is cheap; the argument itself is the part
  with actual judgement in it, and running a challenger on a 1b model produces a challenge not worth
  answering. This may be the line: the debate turns stay on the session model, the digest drops.
- **Whether summarization is throwaway.** A bad summary silently rewrites what a phase knows, and the
  failsafe fires precisely when the window is most loaded. This is the riskiest one to demote.
- **What happens when the small model is not installed.** Falling back to the session model silently is
  wrong for the same reason a hard-coded default model is wrong; it should be a visible state — the status
  line already carries `no model` for the session case and can carry this.
- **Whether the user picks it.** `/models use` sets the session model; there is no equivalent for the
  small lane, and inventing one means a second piece of `state.json` and a second thing on the status line.
