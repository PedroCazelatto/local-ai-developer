# 07 — New standards files

**Milestone:** M2 — Knowledge retrieval
**Depends on:** 05 (format), can land before or after 06.

## Why

Today `rules/standards/` has only `clean_architecture.md` and `hexagonal_ddd_manifesto.md`. The Standards Reviewer can ask about high-level layering and DDD purity but has nothing to say about Python idioms, tests, errors, or naming — which is what most reviews on most projects actually want.

`search_rules` (task 06) only pays off when there's enough catalog to pick from.

## Files (new, all under `rules/standards/`)

Each file: YAML frontmatter (`name`, `description`) plus a short body. Keep each one tight — the on-demand-load story works best when files are small.

1. **`testing_discipline.md`** — Test-before-code, what counts as a meaningful failing test, no mocking the thing under test, fixture conventions, assertion granularity. Highest-impact addition for the Developer persona.
2. **`python_idioms.md`** — Type-hint discipline, no `typing.Any`, prefer `Protocol` / `TypedDict`, dataclasses for boundary types, no implicit `Optional`. Mirrors the rule the orchestrator codebase already follows.
3. **`error_handling.md`** — Raise vs. return, no bare `except`, error types as part of the API surface, when to wrap, when to let propagate.
4. **`naming_conventions.md`** — `snake_case` for modules/functions, `PascalCase` for classes, kebab-case for persona/standard slugs, file-per-class for tools.
5. **`commit_hygiene.md`** — Small commits, one logical change per commit, imperative subject, body explains the why. Useful once Git tools land; harmless before.
6. **`documentation.md`** — README scope and section order for projects under development, docstring expectations (when to write one, what to put in it), avoid restating what the code already says.

## Style notes for each file

- Start with one sentence describing the rule's scope in plain English.
- Then 5–15 bullets, each a concrete rule. Avoid prose paragraphs — the model scans these.
- Where useful, end with one or two short examples (do/don't pair).
- Keep total length under ~80 lines per file. If a topic grows beyond that, it's two standards, not one.

## Acceptance

- After this task, `load_catalog()` returns at least 4 entries (the two existing + the first two new ones), with no parsing errors.
- A Standards Reviewer phase, prompted to review a function with poor types, picks up `python-idioms` via `search_rules` without the user having to name it.
