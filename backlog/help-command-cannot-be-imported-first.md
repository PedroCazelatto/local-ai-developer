# `help.ts` cannot be the first module imported

**Category:** Engineering quality

Entering the module graph at `src/interface/commands/help.ts` throws before any code runs:

```
$ npx tsx -e "import('./src/interface/commands/help.js')"
ReferenceError: Cannot access 'helpCommand' before initialization
```

It is a **temporal dead zone** across an import cycle: `help.ts` needs the command list to render help,
the command list contains `helpCommand`, and entering at `help.ts` makes its own binding the one that is
still uninitialised when the cycle closes back onto it.

## It is latent, not a regression

The `src/interface` sweep probed **ten entry points, one process each**, and found this one and only
this one. Every path the application actually takes is fine — `run-repl.ts`, `handle-command.ts`,
`complete-line.ts` — because none of them enters the graph at `help.ts`. **It fails identically at the
commit before the sweep**, so the split neither caused it nor widened it; it made it findable.

**The method is the reusable part: one process per entry point.** Node's module cache means first-import
order is the only variable that matters, and a second import inside the same process is served from
cache and can never reproduce it. A single script importing ten modules in a loop proves nothing.

## Why this is a task and not a note

**It blocks test coverage.** [constitution.md](../constitution.md) requires a test to import the file
that owns the function under test — so a test for `helpCommand` enters the graph at exactly this module
and throws at import time, before a single assertion runs. That makes this a **prerequisite** for the
follow-up half of [test-the-invariant-functions.md](test-the-invariant-functions.md), not a curiosity to
file and forget. Today nothing imports `help.ts` first, so nothing breaks; the first test written for it
is what turns latent into blocking.

## Decisions, open

- **Break the cycle, or accept it and document the constraint?** Accepting it means the file carries a
  header saying "never import this first", which is a rule no compiler enforces and the next reader has
  no reason to expect.
- **If broken: which direction?** The command list could be injected rather than imported, or the help
  renderer could take the list as a parameter — the same shape the `interface` wave used elsewhere, and
  which would also make `helpCommand` testable in isolation.
- **Do the other nine entry points get a regression probe?** The ten-process sweep found one defect in
  ten; whether that is worth pinning permanently, or was a one-off audit, is a judgement about how often
  import order changes.

## Why it sits where it does

Small, self-contained, and nothing currently depends on it — but it is **ordered before any test that
touches `src/interface/commands/`**, because that test cannot be written until this is settled one way
or the other.
