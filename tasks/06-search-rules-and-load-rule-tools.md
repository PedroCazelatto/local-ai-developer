# 06 — `search_rules` and `load_rule` tools

**Milestone:** M2 — Knowledge retrieval
**Depends on:** 05 (catalog), 01 (tools reachable).

## Why

CLAUDE.md describes a two-step retrieval pattern that keeps the main context lean: the model describes its intent, a *throwaway* LLM context resolves intent → standard name(s), and only the chosen file enters the main context. The main session never sees the full catalog.

## Files

- New `tools/search_rules.py`
- New `tools/load_rule.py`
- Probably a helper in `core/llm/` for the throwaway call.

## `load_rule(name: str) -> str`

Trivial: look up the standard by `name` (from the catalog), return the full markdown minus frontmatter. Error if unknown.

## `search_rules(intent: str) -> list[str]`

The non-trivial one. Steps:

1. Load the catalog (task 05).
2. Spawn a fresh Ollama call (NOT through `Memory` — this never enters session history).
3. Send a system prompt like: *"You match developer intent to a small catalog of coding-standards documents. Return ONLY the names of the matching standards as a JSON array of strings. If nothing matches, return `[]`. Names must come from the catalog."*
4. Send the catalog (just `name` + `description`, one per line) and the intent.
5. Parse the JSON response. Validate every returned name is real.

## Model and context

Use the **same model as the active session, with the same `num_ctx`**, but a **fresh API call** — no session memory, no carry-over. The catalog and the intent live and die inside this one call. Same model means no second download; fresh context means the catalog never lands in session memory.

## Reliability notes

- Always validate parsed names against the catalog. The model will occasionally hallucinate a name; treat the response as untrusted input.
- Empty result is fine. The calling persona should be able to ask the user, or proceed without a standard.
- Keep the throwaway prompt **as short as possible**. The catalog grows over time (task 07 doubles it). If it gets larger, switch to retrieval over embeddings — not in scope here.

## Acceptance

- Standards Reviewer, asked to review a function for "layering violations", calls `search_rules(intent="layering between domain and infrastructure")` and receives `["clean-architecture"]` (or both, depending on phrasing).
- Standards Reviewer then calls `load_rule("clean-architecture")` and produces a review citing it.
- `tool_audit.jsonl` shows both calls; no catalog content appears in the session memory dump (only the loaded rule body).
