# Split `config.ts` into one function per file

**Category:** Repo hygiene

`src/core/session/config.ts` holds **four** functions — `resolveNumCtx`, `resolveRatio`,
`resolveTimeoutMs` and `loadConfig` — against the constitution's *one function per file, least
responsibility* rule. It has been an existing, deliberate exception for env resolution.

The exception ends. From OPEN-QUESTIONS.md **#47**:

> Each function must be on its own file, and the `config.ts` just reexports them inside the config
> object.

## The shape of a fix

Four files, kebab-named after the job each does — `resolve-num-ctx.ts`, `resolve-ratio.ts`,
`resolve-timeout-ms.ts`, `load-config.ts` — plus whatever new resolvers land later.
`config.ts` keeps the `DEFAULT_*` constants and the `SessionConfig` type, imports the resolvers, and
**assembles them into the config object**. Nothing outside changes: `loadConfig(projectName)` stays the
entry point.

`SessionConfig` moves to `config.type.ts` beside it, per the constitution's sibling-types rule.

## Why it is filed separately

It surfaced as the small tail of
[budget-ceilings-for-runs-and-batches.md](budget-ceilings-for-runs-and-batches.md) (#47: where does the
new budget resolver go?), but the answer was not "put it in `config.ts`" — it was "the file stops
holding four functions." That is a refactor of an existing file with its own review surface, and
bundling it into the budget work would hide it inside a feature commit.

**Order matters:** ship this **before** the budget ceilings, so the new resolver is written into the
shape that already exists rather than added to the exception and moved afterwards.

## `ollama-models.ts` is split too (#94a)

The repo's other deliberate multi-function file goes the same way. `src/core/llm/ollama-models.ts` holds
`listModels`, `hasModel` and `pullModel` behind a header arguing for cohesion — *"a cohesive module
(list / hasModel / pullModel over the one daemon), not one function per file"* — which is the same
argument `config.ts` was making about env resolution, and it loses for the same reason. Three files,
plus the shared `daemon` client, which is a value rather than a function and belongs in its own module
the three import.

**The rule has no exceptions, and that is now stated where the rule is read.** #94's answer —
*"this is a repo rule, say it on CLAUDE.md"* — means the one-function-per-file rule gets a line in
[CLAUDE.md](../CLAUDE.md)'s working rules rather than living only in
[constitution.md](../constitution.md)'s *Code structure & clarity*. Both are governance docs, so **those
two edits are review-gated**: made in the shipping commit's working tree and handed over, not committed.

After this task there are **no** multi-function files left in `src/`, which is what makes the rule
checkable rather than aspirational.
