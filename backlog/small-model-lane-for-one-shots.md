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

This is the sibling of the per-window `num_ctx` task, which has **shipped**: that one gave each call's
role its own ceiling, this one would give some of them a different model. They were designed together and
share a resolution point, so most of the work is already done — `CallRole` names all eleven call sites and
`resolveWindowCtx` is where a second lane's model would be chosen. What remains is the model half, and it
was deferred by decision rather than blocked; see the entry in `backlog/README.md` for the measurement
that deferred it.

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

## Answered — and the acceptance test the lane now has to pass is one it cannot

**The project's optimization target is stated** (OPEN-QUESTIONS.md meta I), and it is the thing this
file was implicitly arguing against:

> Using less than half of the context ceiling or smaller models for some task may be optimizing time,
> but that is not the goal of this project. As we are already using models way weaker than the cloud
> ones, we must focus on precision and accuracy rather than time taken. The only bottleneck must be
> the size of VRAM so the model runs on GPU or NPU rather than CPU.

Every open decision in this file followed from that:

- **The CPU-pinned arm (`options.num_gpu: 0`) is excluded** (#57): *no model can be run on CPU.* That
  removes the one design where the session model is never evicted from VRAM at all — and it was the
  most interesting arm, since it has no hop in either direction.
- **The measurement is output quality, and latency is not a factor** (#58): *the output must be better,
  that is the measurement. Time is irrelevant.*
- **The latency numbers are not worth recording** (#59): *I don't care about the numbers.*
- **If the lane is ever built, it is filed as its own task** (#60b) — a second model resolution point, a
  second `activeModel`-shaped setting, a second `/models use` form, and token counts summed across two
  tokenizers is not a thing to smuggle into a measurement pass.

**Which leaves the lane failing its own test by construction.** Every argument in this file — the VRAM
saving, the eviction avoided, the latency per session, the "13–22 s is really hop − 6.6 s" correction,
the 32b's ~33 s bounded-one-shot rebuild — is a **time and residency** argument. Under #58 none of them
count. The remaining claim would have to be that a 1.5–3b model writes *better* context titles, commit
messages, rule matches and summaries than the 14–32b session model, and nothing in the record suggests
it does. The one role where quality was already flagged as the risk — summarization, which "silently
rewrites what a phase knows" — is the one that would be demoted onto the weakest model.

**The two small models were never pulled.** Task I's benchmark was authorized but held on #1, and #1's
answer is *nothing is pulled without approval*, which this request never received.

## Status

**Recommended for closure, not deferral.** The earlier entry in [backlog/README.md](README.md) called
this *"deferred by decision, not blocked"* on a latency measurement; meta I supersedes that with a
reason that does not expire. Closing it means deleting this file and striking its line.

That is not done here, because closing a task is the user's call and #60 reads as *keep the possibility
alive*: see [OPEN-QUESTIONS.md](../OPEN-QUESTIONS.md) **#90**.
