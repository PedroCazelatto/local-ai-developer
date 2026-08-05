# Hint the matching standard instead of waiting to be asked

**Category:** Model behavior / instructions

`search_rules` → `load_rule` is good design and does not change: progressive disclosure, catalog held in a
throwaway context, main window never sees the catalog.

The difference is *who initiates*. Here the model must think to search, and a small model routinely will
not. The standards then exist but are never read, which looks identical to not having them.

Cheap fix that preserves the design: at Worker and Reviewer seed time, run one throwaway match of the task
text against the catalog and inject the top standard's **name** — not its body — as a hint the phase can
act on. It costs one small call (a natural user of
[small-model-lane-for-one-shots.md](small-model-lane-for-one-shots.md)) and a few tokens, and it keeps the
model as the one that decides to load.

## Why this shape

From [harness-gaps-vs-claude-code.md](harness-gaps-vs-claude-code.md). Claude Code's equivalent is its
skills mechanism, and the structure is nearly identical to `search_rules` with one deliberate difference:
**the catalog of names and one-line descriptions is always in context; only the bodies are deferred.**

That inversion is the entire fix. The expensive thing about a standards library is the standards, not their
titles. A dozen `name — one-line description` rows cost a few hundred tokens; the bodies cost thousands.
Keeping the index resident means the model never has to *remember that a library exists* — it can see it —
and the decision it makes is the cheap one: which body is worth loading now.

The same pattern shows up a second time in this session's own harness, applied to tool definitions rather
than documents: roughly a hundred MCP tools are present **by name only**, with their schemas fetched on
demand. Names resident, bodies deferred, retrieval initiated by whoever can see the names.

The reason this task proposes a *hint* rather than a resident catalog is the 16k budget: even a name-only
catalog is a recurring cost on every turn of every window, and it grows with `rules/standards/`. One matched
name injected once at seed time is the same idea sized for this project. If the catalog stays small, making
it resident is the stronger version of the same change.

## Open decisions

- **Hint versus resident catalog.** Measure the catalog's actual name-only size before assuming the hint is
  the affordable option — if it is 200 tokens, resident is better and simpler.
- **Whether a hint the phase ignores should be escalated.** The Reviewer could be told which standard the
  Worker was hinted at and never loaded. That is a stronger guarantee and also a way to fail a task on a
  technicality.
- **What "top" means when nothing matches well.** A forced top-1 match against a task the standards do not
  cover injects a misleading hint. The throwaway call needs a way to answer "none", and its prompt has to
  make that an acceptable answer rather than a failure.
