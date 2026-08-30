# Make the standards visible instead of waiting to be asked

**Category:** Model behavior / instructions

Nine reusable standards live in [rules/standards/](../rules/standards/) and the model only sees them if
it thinks to call `search_rules`. A small model routinely will not. The standards then exist but are
never read, which looks identical to not having them.

**The answer changed the shape of the fix.** This file originally proposed *one throwaway match per
seed, injecting the top standard's name*. That is no longer the design.

## The design (answered — OPEN-QUESTIONS.md meta H, #48, #55)

**Every standard's name is resident at `ctx[0]`, in every phase.** The names go into the system prompt,
so no phase ever has to *remember that a library exists* — it can see it. That is meta H in one line:
*the name of all standard rules must be passed at ctx[0], thus every phase knows them.* And #55b: not
Worker and Reviewer, **every phase**.

**Retrieval becomes three steps, not two.** A new tool sits between seeing a name and paying for a
body:

1. **Resident names** — `ctx[0]` lists every standard slug. No call, no match, nothing to initiate.
2. **`describe_rule(name)`** *(new)* — returns that standard's one-line description so the model can
   judge whether it is the right one **before** loading it. This is the context saving: the model pays
   one short description instead of a whole body to find out it picked wrong.
3. **`load_rule(name)`** — unchanged; pulls the full body.

**Standard names are therefore load-bearing and must be semantic** (#48). Today's nine already are —
`testing-discipline`, `error-handling`, `naming-conventions`, `commit-hygiene`, `documentation`,
`language-idioms`, `clean-architecture`, `hexagonal-ddd-manifesto`, `simplified-technical-english` —
and that stops being a nicety and becomes a rule the `rules/standards/` folder has to keep. A standard
named badly is a standard no phase will ever describe, let alone load.

**Measured cost of the resident half:** ~50 exact tokens for the nine slugs alone (the full catalog
*with* descriptions is 530). Against a 16 384 ceiling that is ~0.3 % of the window per turn — which is
what makes "resident" affordable and is why option (a)'s per-seed hint call was dropped.

## What survives from the hint design (answered — #49–#54, #56)

The hint is not gone: a matched standard is still surfaced. It now sits **alongside** the resident
names rather than instead of them.

- **Every Reviewer window is hinted** (#49b) — all five rounds, not just round 1.
- **The match runs on all phases, against title or body** (#50). One rule, uniformly: match the task's
  title *or* its body. Not the Worker-vs-Reviewer split the question offered — the Reviewer gets the
  same text the Worker got.
- **`search_rules` always returns a top-1, even when nothing matches well** (#51). There is no "none"
  answer and no omitted line: the model is the one that decides whether the suggestion is worth
  loading, which is exactly what `describe_rule` now makes cheap. This deliberately overrides this
  file's original *"the throwaway call needs a way to answer 'none'"*.
- **The Reviewer runs at the Worker's ceiling** (#53) — the base `OLLAMA_NUM_CTX`, no table entry in
  `resolve-window-ctx.ts`, no runner rebuild. That matters more than it did: the rebuild was
  re-measured at **~16–18 s on a 32b**, so a bounded 8 192 hint fired up to six times per task would
  cost ~33 s each.
- **An ignored hint is escalated to the Reviewer** (#54c): the Reviewer is told the rule was **not
  loaded**. This needs tracking that does not exist — nothing records which `load_rule` calls a window
  made — so it is new work, and it is the sharp end of the feature: it is a way to fail a task on a
  technicality, and the Reviewer's prompt has to be written so that "the Worker did not load the hinted
  standard" is evidence, not a verdict.
- **The hint prints one line in the scrollback, formatted as a tool call** (#56) — the `→ <tool> <arg>`
  row that every other call already gets, so an unexplained pause never appears in an unattended run.

## Why the resident catalog won

This file argued for a hint over a resident catalog on a 16k budget, and named its own condition:
*"If the catalog stays small, making it resident is the stronger version of the same change."* The
measurement said 50 tokens for names-only. The condition was met.

The structure now matches Claude Code's skills mechanism exactly — **names resident, bodies deferred,
retrieval initiated by whoever can see the names** — with `describe_rule` as the middle rung that
mechanism gets for free from a one-line description in its listing.

## Still open

- **#88 — does `search_rules` survive, and what is it for now?** With names resident at `ctx[0]` and
  `describe_rule` answering "is this the right one", `search_rules` no longer holds the only door. #51
  still gives it a job (always return a top-1 match), but nothing says whether a phase may still call
  it directly, or whether it becomes purely the seed-time matcher. Its throwaway `search-rules` role
  and its 8 192 ceiling entry both depend on the answer. See
  [OPEN-QUESTIONS.md](../OPEN-QUESTIONS.md) #88.
- **#89 — `worker.md` and `reviewer.md` already order an unconditional
  `load_rule("simplified-technical-english")`.** With every name resident and a hint arriving too, that
  standard can now be named three times in one seed. #52 was answered *"already answered"*, but the
  duplicate-suppression half (#52b) was never decided and this design makes it more likely to fire, not
  less. See [OPEN-QUESTIONS.md](../OPEN-QUESTIONS.md) #89.
