# Dead exports and unused imports, neither of which the build can see

**Category:** Repo hygiene

Backlog item 1's sweep read every file under `src/` and turned up two kinds of code nothing consumes.
They look like one problem and are **two**, separated by whether a compiler flag could ever find them.

## The kind a flag would find: 40 unused declarations in 20 files

`tsconfig.json` sets `noUncheckedIndexedAccess` and `noImplicitOverride` and **neither
`noUnusedLocals` nor `noUnusedParameters`**. Turning the first on reports **40 diagnostics across 20
files**, every one an import that is named and never used.

The pattern is copy-paste debris rather than rot: `worker-deps.type.ts`, `reviewer-deps.type.ts` and
`context-title.type.ts` each import the same block —
`{ OllamaClient, Message, StreamHandle, TokenCounts, Tool, ToolCall }` — and use a subset. A new
`.type.ts` module was seeded from a neighbour and the import list came along.

Worth knowing that the number is **not** an artefact of the sweep: measured at that wave's start it was
**45**, and it is **40** now, the difference being five that were dropped when a file was folded. **The
sweep neither created these nor cleaned them; it made them countable.**

## The kind no flag will ever find: exports with no consumer

An `export` is *used* by definition, so `noUnusedLocals` is silent on a function nothing imports. Three
are known, each found by hand:

| symbol | where | how it was found |
|---|---|---|
| `ChatRole` | `src/core/llm/` | only its own declaration and one barrel line |
| `codeOf` | `src/tools/code-of.ts` | zero callers anywhere |
| `runWorkerTask` | `src/core/session/run-worker-task.ts` | exported from the barrel, imported by nothing |

`runWorkerTask` is the instructive one. It is the **only** construction site of `WorkerResult`, so that
type is consumed nowhere either — a dead function keeping a live-looking type alive behind it. Deleting
the function is what makes the type's deadness visible, which is why the two should be looked at
together rather than one at a time.

**A barrel is what hides this class**, and that matters for sequencing: while `index.ts` re-exports a
name, the name has an importer, so nothing looks unused. Wave E deletes the last six barrels — **after
which a search for "exported and never imported" becomes meaningful for the first time.** Run the sweep
for dead exports then, not before.

## Decisions, open

- **Does `noUnusedLocals` go on?** It is 40 diagnostics to clear first, and it changes the build for
  everyone afterwards. The argument for it is that this class recurs by copy-paste and a flag ends the
  class rather than the instances. The argument against is that a half-written function with a parked
  import stops compiling mid-edit, which is a real cost on a codebase written by a local model.
  **`noUnusedParameters` is a separate question** and probably wants a different answer, since an
  interface-conforming callback often ignores an argument on purpose.
- **Are the three dead exports deleted, or is one of them a seam kept deliberately?** `runWorkerTask`
  looks like a Worker entry point that the task loop was expected to call and does not. Deleting it may
  be right, or may be deleting half of an unfinished feature — **check against
  [docs/phases.md](../docs/phases.md)'s execution loop before removing it**, and ask rather than assume.
- **Does deleting `runWorkerTask` take `WorkerResult` with it?** It should, on the same reasoning, but
  the type was just placed by the seam-versus-result rule and moving it twice in two commits is worth
  doing deliberately.

## Why it sits where it does

Small, independent, and nothing depends on it. **It ships after wave E**, for the reason above: the
barrels are what make a dead export look live, so the search worth running is the one run after they are
gone. Filed rather than folded into item 1 because deleting a function is a behaviour change, and burying
one inside a no-behaviour-change refactor is how a change stops being reviewable — the same rule that
produced every other item filed out of that sweep.

## Item 6 added three more, and its agents deliberately did not remove them

Recorded here because both item 6 agents hit this file's rule — *an export with no consumer is a
question, not a cleanup* — and correctly stopped rather than guessing:

| now dead | why | what removed its caller |
|---|---|---|
| `src/core/llm/has-model.ts` | `/models use` now reads `listModels` instead, because the same `/api/tags` round trip answers *"is it here?"* and *"can it call tools?"* | item 6, part A |
| `src/core/ui/confirm.ts` | already had zero callers before item 6 | — |
| `src/core/ui/text-input.ts` | already had zero callers before item 6 | — |

**One went the other way, which is the useful data point:** `src/core/ui/select.ts` had **no callers
at all** and gained its first from item 6's boot chooser. So a caller-less export in this repo is not
reliably dead — it is sometimes a facility built ahead of its use, and `select.ts` is the proof. That
is the strongest argument yet for this file's position that the question goes to the user.

`has-model.ts` is the one that is genuinely newly-orphaned rather than long-idle, and its own header
already tells a caller that needs the list to match against it directly — so the header anticipated
the change that orphaned it.
