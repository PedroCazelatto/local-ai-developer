> **Status:** ✅ Completed (2026-07-11) — `src/context/standards-catalog.ts` (+ `.type.ts`) and the barrel export committed. The two `rules/standards/*.md` frontmatter edits (`clean-architecture`, `hexagonal-ddd`) are left **UNCOMMITTED** for user review (constitution: global instruction files are never auto-committed). ⚠️ `loadCatalog()` throws on boot until that frontmatter is committed.

# 01 — Standards catalog (frontmatter + loader)

**Version:** V4
**Depends on:** Foundation/01 (TS source tree under `src/`).
**Blocks:** V4/02 (`search_rules` needs a `{name, description}` catalog to search), V4/03 (new standards files must conform to this format).

## Why

`search_rules` (V4/02) needs a `{name, description}` catalog of every standards file to hand to its throwaway-context model (CLAUDE.md, "Rules loading" → "Retrieval: LLM-delegated search"). Today `rules/standards/*.md` carries no machine-readable metadata. This task adds the frontmatter format and a loader **separately from the tools that consume it**, so the format is clean before two tools depend on it. The loader must fail loudly on bad metadata — a silently-skipped standard is a standard the model can never reach.

## Behavior

Every file under `rules/standards/` gains YAML frontmatter:

```markdown
---
name: clean-architecture
description: Onion layering, dependency rule, layer responsibilities. Use when reviewing module boundaries or deciding whether a dependency points inward.
---

# Manifesto: Clean Architecture
...
```

- `name` — kebab-case slug, **unique** across the folder. This is the exact argument `load_rule(name)` (V4/02) takes.
- `description` — what the throwaway model sees when matching intent → file. It must say **when** the standard applies, not just what it covers. "Use when reviewing module boundaries" > "About architecture". The body is never shown at search time.
- One file = one standard. No grouping inside a single file.

`loadCatalog()` (in `src/context/`):

- Reads every `*.md` under `rules/standards/` (orchestrator repo, **not** the active project — rules are global, CLAUDE.md "Rules loading").
- Parses **only the frontmatter** of each file and returns `StandardEntry[]` where `StandardEntry = { name: string; description: string }`. It does **not** read or return the markdown body — bodies load on demand via `load_rule` (V4/02).
- Fails loudly (throws a typed error naming the offending file) when any standards file:
  - has no frontmatter block, or is missing `name` or `description`, or either is empty/whitespace;
  - has a `name` that collides with another file's `name` (report both paths).
- Result is suitable to cache in memory after the first call; a stale-on-edit cache is acceptable for V4 (no `/reload-rules` required). If you cache, document that editing a standard's frontmatter needs a restart.

```ts
// src/context/standards-catalog.ts
export interface StandardEntry {
  name: string;        // kebab-case, unique
  description: string; // when-to-use text shown at search time
}
export function loadCatalog(): StandardEntry[];
```

## Files

- `rules/standards/clean_architecture.md` — add frontmatter (name `clean-architecture`).
- `rules/standards/hexagonal_ddd_manifesto.md` — add frontmatter (name `hexagonal-ddd`).
- `src/context/standards-catalog.ts` — new; `StandardEntry` type + `loadCatalog()`. Use a small YAML/frontmatter parser already in `package.json` if present; otherwise a minimal `---`-delimited parser is fine (frontmatter is `name:`/`description:` only).
- `src/context/index.ts` (if the context layer has a barrel) — export `loadCatalog`, `StandardEntry`.

## Notes / pitfalls

- **Global, not per-project.** Resolve `rules/standards/` against the orchestrator install dir, never `projects/<active>/`. Projects are agnostic to the orchestrator.
- **Bodies stay on disk until requested.** `loadCatalog` parses frontmatter only; do not eagerly read full files. Keeps startup cheap and keeps the main context from ever holding bodies it didn't ask for.
- **Fail loud, never silent.** A missing/duplicate `name` must abort with a clear message, not drop the entry — a dropped entry is invisible to `search_rules` forever.
- Description quality is load-bearing: it is the *only* signal the search model gets. Write it as "Use when …".

## Acceptance

- With only the two existing standards present, `loadCatalog()` returns exactly two entries, each with a non-empty `name` and `description`, and `name`s `clean-architecture` and `hexagonal-ddd`.
- Delete the frontmatter from one standards file and boot a scripted check that calls `loadCatalog()` → it throws an error naming that file's path; it does not return one entry silently.
- Give two files the same `name` → `loadCatalog()` throws naming both paths.
- After V4/03 lands six more files, `loadCatalog()` returns eight entries with **no code change** to the loader.
- A scripted dump of the returned entries shows no markdown body text — only `name` + `description`.
