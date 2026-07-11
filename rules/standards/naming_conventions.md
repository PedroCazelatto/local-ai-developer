---
name: naming-conventions
description: camelCase/PascalCase in TS, snake_case/PascalCase in Python, kebab-case slugs, one tool per file, intention-revealing names, and the phase vocabulary (no persona/role). Use when naming files, functions, types, or slugs, or reviewing names.
---

# Standard: Naming Conventions

Names reveal intent and follow the casing rules of their stack, with kebab-case for slugs and one job per file.

- TypeScript: `camelCase` for values and functions, `PascalCase` for types and classes, kebab-case file names.
- Python: `snake_case` for functions, variables, and modules; `PascalCase` for classes; `UPPER_SNAKE` for constants.
- Phase and standard slugs are kebab-case and unique (e.g. `naming-conventions`, `worker`).
- One tool per file; the file name names that tool's single job.
- Names reveal intent — a reader should not need a comment to know what a name holds.
- Booleans read as predicates: `isReady`, `hasNext`, `should_retry`.
- Prefer full words over cryptic abbreviations; use only abbreviations everyone knows.
- Use the domain's vocabulary consistently — one concept, one name.
- Use the **phase** vocabulary throughout; never "persona" or "role".
- Don't encode the type in the name (no Hungarian notation); the type system already states it.

**Do:** `parse-config.ts` exporting `parseConfig`.
**Don't:** `utils.ts` exporting `doStuff`.

**Do:** "phase".
**Don't:** "persona" / "role".
