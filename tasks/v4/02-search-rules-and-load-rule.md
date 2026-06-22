> **Status:** ⬜ Not started

# 02 — `search_rules` and `load_rule` tools

**Version:** V4
**Depends on:** V4/01 (catalog + loader), V1/02 (tool registry + dispatch so tools are reachable by the model), Foundation/03 (Ollama client `chat`).
**Blocks:** V4 exit criterion (a Reviewer answering a layering question via `search_rules`→`load_rule`→citation).

## Why

CLAUDE.md ("Rules loading" → "Retrieval: LLM-delegated search") describes a two-step pattern that keeps the main context lean: the model describes its intent, a **throwaway** Ollama context resolves intent → standard name(s), and only the chosen body ever enters the main context. The main session **never** sees the full catalog. This task adds the two tools that implement that split.

## Behavior

### `load_rule(name: string)`

The trivial one. Looks up the standard by `name` in the catalog (V4/01), reads that file, and returns the **full markdown body with the YAML frontmatter stripped**. Structured error if `name` is not in the catalog.

```ts
// tools/load-rule.ts
// returns the body (no frontmatter) as the tool result string
// on unknown name: { error: "unknown standard", name, available: string[] } — recoverable
```

### `search_rules(intent: string)`

The non-trivial one. Returns a JSON array of standard `name`s (possibly empty).

Steps:

1. `loadCatalog()` (V4/01) → the `{name, description}[]`.
2. Spawn a **fresh, throwaway Ollama call** — a brand-new `messages` array built only for this call, run against the same session model with the same `num_ctx`, and **never added to any phase's session history** (not routed through the memory layer of V4/04). The catalog and the intent live and die inside this one call.
3. System prompt (keep it **short** — the catalog grows): *"You match a developer's intent to a small catalog of coding-standards documents. Return ONLY a JSON array of the matching standard names, drawn verbatim from the catalog. If nothing matches, return `[]`. Do not invent names, do not add prose."*
4. User content: the catalog as one `name: description` line per standard, then the `intent`.
5. Parse the model's reply as a JSON array of strings. Treat the reply as **untrusted**: discard anything that is not a string and drop any name not present in the catalog (compare against the loaded `name`s).
6. Return the validated, deduplicated list. Empty is a valid, expected result.

```ts
// tools/search-rules.ts
// returns: { matches: string[] }   // validated against catalog; may be []
```

A small helper for the throwaway call belongs in `src/core/llm/` (e.g. `oneShot(messages, { numCtx }): Promise<{ content, promptEvalCount, evalCount }>`) so both this task and V4/05 (summarization) share one path for "fresh Ollama call, not in session memory".

## Files

- `tools/search-rules.ts` — new; the throwaway-context intent matcher above.
- `tools/load-rule.ts` — new; frontmatter-stripped body fetch.
- `src/core/llm/one-shot.ts` (or extend the Ollama client) — helper for a fresh, history-free Ollama call returning content + exact token counts. Shared with V4/05.
- Tool registration wherever V1/02 discovers tools — register both so the model can call them.

## Notes / pitfalls

- **The catalog never enters session memory.** It is assembled inside the throwaway call and discarded. Only the body that `load_rule` returns lands in the main context. A scripted memory dump after a search must contain no catalog text.
- **Throwaway = not in history.** Build a standalone `messages` array; do not append these turns to the active phase's persisted history (V4/04). Same model, same `num_ctx`, separate call — exactly the choice in CLAUDE.md.
- **Model output is untrusted.** Always validate returned names against `loadCatalog()`. A hallucinated name must be dropped, not passed to `load_rule`. Malformed (non-array / non-JSON) output → return `{ matches: [] }`, not a thrown error.
- **Tokens stay exact.** The throwaway call still reports `prompt_eval_count`/`eval_count`; if you log this call's cost, log the exact values. Never estimate from string length — a length-based token heuristic is forbidden anywhere in this repo.
- **Both calls are audited.** Per CLAUDE.md, every tool call is logged to the audit log (V1/06).
- Catalog growth: if it ever outgrows a single short prompt, switch to embedding retrieval — explicitly **out of scope** here.

## Acceptance

- In a scripted session on the Reviewer phase, calling `search_rules("layering between domain and infrastructure")` returns `{ matches: ["clean-architecture"] }` (or includes `hexagonal-ddd`, depending on phrasing) — never an unknown name.
- `load_rule("clean-architecture")` returns the manifesto body with no `---` frontmatter block at the top; the Reviewer then produces a review citing it.
- `load_rule("does-not-exist")` returns a structured recoverable error listing available names — it does not crash the turn.
- Feed `search_rules` a hand-mocked model reply containing a fake name → that name is dropped; only catalog-valid names come back.
- A memory dump of the active phase after both calls contains the loaded rule body but **no** catalog listing. The audit log shows both calls.
