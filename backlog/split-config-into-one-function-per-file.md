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

## Not in scope

The other deliberate multi-function file, `src/core/llm/ollama-models.ts`, whose header argues for
cohesion (*"a cohesive module (list / hasModel / pullModel over the one daemon), not one function per
file"*). #47 was answered about `config.ts`. Whether the same ruling applies there has not been asked —
see [OPEN-QUESTIONS.md](../OPEN-QUESTIONS.md) #94.
