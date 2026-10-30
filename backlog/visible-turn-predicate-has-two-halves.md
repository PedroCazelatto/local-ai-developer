# "Still in the phase's live history" is defined twice, and nothing checks the two agree

**Category:** Memory / context

The predicate that decides whether a turn is still part of a phase's live history exists in **two
languages, at two execution sites**:

| half | file | form |
|---|---|---|
| SQL | `src/core/session/visible-turn-where.ts` | `` `${alias}replaced_by IS NULL AND ${alias}cancelled_at IS NULL` `` |
| JS | `src/core/session/visible-turns.ts` | `records.filter((r) => r.replacedBySeq === undefined && r.cancelledAt === undefined)` |

The SQL half filters turns read back from `memory.db`. The JS half filters turns still held in RAM.
**They must agree, or a flush changes what a phase can see** — the same conversation would gain or lose a
turn purely by crossing the persistence boundary, which is exactly the class of bug that is impossible to
reproduce from a transcript.

**It cannot be deduped.** One runs inside SQLite and one runs in Node; there is no shared expression to
extract. Both headers now cross-reference each other, which is the best guard prose can offer and is not
a test.

Worth stating plainly, because it is the reason this is filed at all: **the duplication was always there;
one file was hiding it.** Backlog item 1's sweep split the module that held both halves, and separating
them is what made the agreement a visible requirement rather than an implicit one. The sweep did not
introduce the risk — it made it addressable.

## Note the asymmetry between the two spellings

The SQL half tests `IS NULL` on two columns. The JS half tests `=== undefined` on two properties. A
record round-tripped through SQLite turns a SQL `NULL` into `null`, not `undefined`, so **the mapping
layer between them is load-bearing** and is part of what a test has to cover. A test that only compares
the two predicates on hand-built objects would miss it; the interesting case is a real row read back.

## Why it is not written yet

**It is the first test in the suite that would touch `node:sqlite`**, and that module is **experimental on
Node 22.x and stable from 24**. The suite has only ever run on **22.14.0**, while `.nvmrc` pins
**24.14.0** — so a test written against the experimental API could pass here and behave differently on the
runtime the repo actually pins.

Two facts make that worse rather than academic:

- **`npm test` runs `node --test` directly and never passes through `scripts/run.mjs`**, which is the only
  thing that enforces the `.nvmrc` pin. So nothing on the test path checks the runtime at all.
- **The `test` script passes `--disable-warning=ExperimentalWarning`**, which switches off the one signal
  that would have announced the experimental API.

So the sequence is: install Node 24.14.0, re-run the existing 400 tests on it, and *then* write this one.
The ruling was to fix the runtime rather than gate `npm test`, because gating it would have refused on
this machine and stripped every agent of its behavioural gate.

## Decisions, open

- **Does the test drive a real `memory.db`, or compare the two predicates in isolation?** Only the first
  covers the `NULL` → `null` mapping described above, but it needs a temp database and moves the test
  past the *"pure functions only"* boundary the constitution draws for the suite. That boundary may need
  a sentence for this case rather than being quietly crossed.
- **Is the agreement asserted over a generated matrix of the four states** (live, replaced, cancelled,
  both) **or over a handful of named cases?** Four states across two halves is small enough to be
  exhaustive, which is unusually cheap for a real guarantee.
- **What happens if they are found to already disagree?** That would be a live defect rather than a
  missing test, and would want its own item.

## Why it sits where it does

It was the last surviving follow-up of backlog item 1, and it is filed as its own task now that item 1
has shipped — otherwise it would have been orphaned inside a task file nobody has reason to reopen. It is
blocked only on the runtime, which is a user action.
