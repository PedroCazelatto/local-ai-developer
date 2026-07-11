> **Status:** ✅ Completed (2026-07-11) — six standards files added under `rules/standards/` (`testing-discipline`, `language-idioms` (TS + Python), `error-handling`, `naming-conventions`, `commit-hygiene`, `documentation`), each with V4/01 frontmatter and a body under ~80 lines. `loadCatalog()` now returns **eight** entries with no code change, no duplicate names, no body leak. Verified against the real V4/01 loader.

# 03 — New standards files

**Version:** V4
**Depends on:** V4/01 (frontmatter format + loader). Can land before or after V4/02.
**Blocks:** the V4 payoff — `search_rules` only earns its keep when there is enough catalog to pick from.

## Why

Today `rules/standards/` holds only `clean_architecture.md` and `hexagonal_ddd_manifesto.md`. A Reviewer can speak to high-level layering and DDD purity but has nothing to say about tests, idioms, errors, naming, commits, or docs — which is what most reviews on most projects actually want. This task adds six tight standards so `search_rules` (V4/02) has a real catalog to resolve against.

## Behavior

Six new files under `rules/standards/`, each with the V4/01 frontmatter (`name` kebab-case unique, `description` written as "Use when …") plus a short scannable body:

1. **`testing_discipline.md`** (name `testing-discipline`) — test-before-code, what counts as a meaningful failing test, never mock the thing under test, fixture/arrange conventions, assertion granularity, one behavior per test. Highest-impact addition for the Worker phase.
2. **`language_idioms.md`** (name `language-idioms`) — idiom discipline keyed to the project stack. Cover **TypeScript** (no `any`; prefer `interface`/`type`, discriminated unions, `unknown` + narrowing at boundaries; `readonly`; no non-null `!` to silence the checker) **and Python** (type hints everywhere, no `typing.Any`, prefer `Protocol`/`TypedDict`/`dataclass` for boundary types, no implicit `Optional`). Projects may be either stack, so the standard must serve both. Mirrors the orchestrator's own rule (CLAUDE.md "Code conventions"; user memory: `typing.Any` / `any` is forbidden).
3. **`error_handling.md`** (name `error-handling`) — throw/raise vs. return, no bare/blanket `catch`/`except`, error types as part of the API surface, when to wrap vs. let propagate, never swallow silently, recoverable structured errors for tools.
4. **`naming_conventions.md`** (name `naming-conventions`) — `camelCase` functions/vars and `PascalCase` types/classes in TS; `snake_case` functions/modules and `PascalCase` classes in Python; kebab-case for phase and standard slugs; file-per-tool. Note the **phase** vocabulary (no "persona"/"role").
5. **`commit_hygiene.md`** (name `commit-hygiene`) — small commits, one logical change each, imperative subject under ~50 chars, body explains the *why*, don't mix refactor + behavior. Pairs with the auto-commit policy (V2/03).
6. **`documentation.md`** (name `documentation`) — README scope and section order for a project under development, when a doc-comment is warranted and what goes in it, don't restate what the code already says, keep `PRODUCT_SPEC.md`/notes current.

## Style for each file (per V4/01 + old task 07)

- Open with **one sentence** stating the standard's scope in plain English.
- Then **5–15 bullets**, each a single concrete rule — no prose paragraphs, the model scans these.
- Where it sharpens a rule, end with **one or two do/don't pairs**.
- **Under ~80 lines per file.** If a topic spills past that, it is two standards, not one.

## Files

- `rules/standards/testing_discipline.md` — new.
- `rules/standards/language_idioms.md` — new (TS + Python).
- `rules/standards/error_handling.md` — new.
- `rules/standards/naming_conventions.md` — new.
- `rules/standards/commit_hygiene.md` — new.
- `rules/standards/documentation.md` — new.

(No code changes — V4/01's loader picks these up automatically.)

## Notes / pitfalls

- **`description` is the only search signal.** Each frontmatter `description` must say *when* to reach for the standard. A vague description makes the standard unreachable via `search_rules`.
- **Unique `name`s.** All six slugs must be distinct from each other and from `clean-architecture` / `hexagonal-ddd`, or V4/01's loader aborts at boot.
- **Serve both stacks.** Projects can be TS or Python; `language-idioms` must give actionable rules for each rather than assuming one. Honor the forbidden-`any`/`typing.Any` rule.
- Keep them tight — the whole point of on-demand loading (V4/02) is small bodies. Bloated files defeat the lean-context goal.
- Use the **phase** vocabulary throughout (no persona/role).

## Acceptance

- After this task, `loadCatalog()` (V4/01) returns **eight** entries with no parsing errors and no duplicate `name`s.
- Each new file is under ~80 lines and opens with a one-sentence scope line.
- On the Reviewer phase, reviewing a function with weak types, `search_rules` (V4/02) surfaces `language-idioms` **without the user naming it** — driven purely by the `description`.
- `search_rules("how should I write the failing test first")` surfaces `testing-discipline`.
- A scripted check confirms every new file has both `name` and `description` in frontmatter.
