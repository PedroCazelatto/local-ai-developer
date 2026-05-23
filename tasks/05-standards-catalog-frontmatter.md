# 05 — Standards catalog (frontmatter + loader)

**Milestone:** M2 — Knowledge retrieval
**Blocks:** 06 (`search_rules` needs a catalog to search).

## Why

`search_rules` (task 06) needs a `{name, description}` catalog of every standards file to pass to its throwaway-context model. Today, `rules/standards/*.md` has no machine-readable metadata. This task adds the format and a loader, separately from the tools that consume it, so the format is clean before two tools depend on it.

## Files

- Every existing file in `rules/standards/` (add frontmatter).
- New `context/standards_catalog.py` (or extend `context/builder.py`) with `load_catalog() -> list[StandardEntry]`.

## Frontmatter format

```markdown
---
name: clean-architecture
description: Onion layering, dependency rule, layer responsibilities. Use when reviewing module boundaries or evaluating whether a dependency points inward.
---

# Clean Architecture
...
```

Notes:

- `name` is a kebab-case slug, unique across the folder. Used as the argument to `load_rule(name)`.
- `description` is what the throwaway model sees when matching intent → file. Make it specific about *when* the standard applies, not just what it covers. "Use when reviewing X" > "About X".
- One file per standard. No grouping by frontmatter.

## Loader behavior

- Parse on startup. Fail loudly if any standards file lacks frontmatter or has a duplicate `name`.
- Cache in memory; reload on `/reload-rules` if you want a dev convenience (proposal — optional).
- Don't load the body until `load_rule(name)` is called — keep memory and startup time small.

## Files to update now

- `rules/standards/clean_architecture.md` — add frontmatter.
- `rules/standards/hexagonal_ddd_manifesto.md` — add frontmatter.

## Acceptance

- `load_catalog()` returns two entries today, both with non-empty `description`.
- Startup fails clearly if you remove the frontmatter from one file (no silent skip).
- After task 07 lands, the catalog has eight entries with no code changes.
