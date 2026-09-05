# One function per file, across `src/`

**Category:** Repo hygiene

Item 1 of the execution order. It began as a two-file refactor and is now the repo-wide sweep that makes
the constitution's *one function per file, least responsibility* rule true rather than aspirational.
**The first increment has shipped; the sweep has not.** This file stays until it does.

## What has already landed

`src/core/session/config.ts` held four functions — `resolveNumCtx`, `resolveRatio`, `resolveTimeoutMs`
and `loadConfig` — as a deliberate exception for env resolution. From OPEN-QUESTIONS.md **#47**:

> Each function must be on its own file, and the `config.ts` just reexports them inside the config
> object.

Done. Each resolver holds `resolve-num-ctx.ts` / `resolve-ratio.ts` / `resolve-timeout-ms.ts`, the
assembly holds `load-config.ts`, and `config.ts` keeps the `DEFAULT_*` constants and re-exports the four.
`loadConfig(projectName)` is still the entry point and nothing outside `core/session/` changed.

`src/core/llm/ollama-models.ts` (#94a) went the same way and no longer exists: `list-models.ts`,
`has-model.ts`, `pull-model.ts`, and the shared `daemon` client — a value, not a function — in
`daemon.ts`. Its cohesion-arguing header is gone; it lost the argument `config.ts` lost.

## The claim that was wrong

#94's answer closed with *"After it, no multi-function files remain in `src/`."* **That was never true.**
A census of the tree after the first increment:

- **212** code files under `src/` (excluding `.type.ts`, `.schema.ts` and `index.ts` barrels).
- **95** of them declare more than one function, holding **461** functions between them.
- **27** export more than one — worst: `memory-db.ts` 11, `renderer.ts` 10, `project-git.ts` 8,
  `backlog.ts` 8, `status-bar.ts` 7, `status-activity.ts` 6, `project-git-stash.ts` 6,
  `project-git-branch.ts` 6.

`config.ts` and `ollama-models.ts` were not the only violations. They were the only two that had
*written the exception down*, which is why they were visible and the other 93 were not.

## The bar

**Any function declaration counts, not just an exported one.** A private helper is a second function and
means a second file. This is not a new severity: `config.ts`'s three resolvers were never exported, and
that is precisely what made it a violation. Judging by exports instead would leave 68 of the 95 files
untouched while claiming the rule holds.

Not violations, and not to be "fixed":

- an **assembler** file that imports single-function modules and re-exports them into one object;
- a file that holds only **constants** (the new `config.ts`);
- a file that holds only a **value** (the new `daemon.ts`).

## The type reversal rides along

The constitution used to require types in a sibling `<name>.type.ts`. **That rule is reversed:** a type
lives in the file that owns the function it describes. **55** sibling type files fold in as the sweep
reaches them. Classified by who imports them:

- **29 mechanical** — nothing but their own sibling and a barrel imports them. Move the declaration up
  into the sibling, retarget the barrel line, done.
- **21 shared** — imported by files beyond their sibling. Still mechanical, just wide: each importer
  changes one path. Widest are `read-tracker.type.ts` (8 importers) and `memory-db.type.ts` (5).
- **5 orphans** — **no `.ts` sibling at all**, so no function owns them. These are the ones that bite:

  | file | non-barrel importers |
  |---|---|
  | `src/core/ui/tool-call-display.type.ts` | 6 — `dispatch.ts`, `retro-runner.ts`, `build-file-diff.ts`, `write-file.ts`, `types.ts`, `format-tool-result-lines.type.ts` |
  | `src/core/llm/call-role.type.ts` | 3 — `client.ts`, `one-shot.ts`, `resolve-window-ctx.ts` |
  | `src/core/ui/markdown-stream.type.ts` | 3 — `turn-loop.ts`, `create-markdown-stream.ts`, `renderer.ts` |
  | `src/core/container/tar-entry.type.ts` | 2 — `encode-tar.ts`, `sandbox.ts` |
  | `src/core/container/sandbox-file.type.ts` | 1 — `sandbox.ts` |

  The drafted rule says a shared type goes with the function that *primarily* describes it, which for
  these forces an arbitrary owner — `write-file.ts` holding the display contract six other files import
  is worse than what exists today. **The clause is with the user**; the recommendation put to them is a
  per-folder shared-vocabulary module, matching the four the repo already has outside the old rule
  (`src/tools/types.ts` 9 declarations, `src/core/session/review-types.ts` 5,
  `src/core/session/types.ts` 4, `src/core/llm/types.ts` 3). **Do not fold an orphan in until that
  ruling lands.**

`.schema.ts` siblings **stay**. A type erases at compile time and costs the function file nothing; a
schema is a runtime value with its own weight and its own imports. There is one in the repo,
`memory-db.schema.ts`, and it is a block of SQL DDL.

## Before any sweep work begins

**`constitution.md` and `CLAUDE.md` currently state the opposite of both rules above.** The amendment is
drafted in the working tree and is review-gated — it is never auto-committed (constitution, *Instruction
integrity*). **It must be reviewed and committed by the user before the first sweep commit**, or the
sweep implements a rule the docs contradict.

## The partition

The sweep is split across several agents by directory, never run as one change. Multi-function files and
the functions inside them, per directory:

| directory | files | functions |
|---|---:|---:|
| `src/core/session` | 27 | 172 |
| `src/interface/commands` | 16 | 84 |
| `src/core/ui` | 14 | 77 |
| `src/tools` | 19 | 58 |
| `src/interface` | 7 | 28 |
| `src/core/container` | 4 | 16 |
| `src/core/llm` | 4 | 11 |
| `src/commands` | 1 | 8 |
| `src/context` | 3 | 7 |

## Two hazards found during the first increment

- **`docs/mental-model.md:27` links `src/core/llm/call-role.type.ts` by path.** Folding that file in
  breaks the link. `docs/` is governance-gated, so the fix is a review-gated edit handed to the user, not
  a commit — and it has to happen in the same change that moves the file.
- **`src/tools/search-in-files.type.ts` has 8 declarations shared by five peer functions**
  (`find-matching-lines`, `merge-line-ranges`, `parse-search-request`, `render-file-matches`,
  `summarize-search`). None of the five naturally owns the request/result vocabulary; it is the orphan
  problem in a file that happens to have a sibling. It should wait on the same ruling.

## Order

**Ships before [budget-ceilings-for-runs-and-batches.md](budget-ceilings-for-runs-and-batches.md)** so
the new budget resolver is written into the shape that already exists rather than added to an exception
and moved afterwards. That half is satisfied by the first increment: the shape exists now. At the widened
scope the sweep also relocates functions that items 2, 5, 6 and 7 test, move or add to, so it stays
first.
