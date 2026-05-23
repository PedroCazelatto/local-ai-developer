# 04 — Cross-persona inbox (replaces `AGENT_NOTES.md`)

**Milestone:** M3 — Cross-persona handoff
**Depends on:** 01 (tools must be reachable by the model).
**Supersedes** the `AGENT_NOTES.md` markdown-file mechanism described in CLAUDE.md.

## Why

CLAUDE.md specifies a single shared `AGENT_NOTES.md` with `## To: <Role>` sections. Re-reading the design with LLM ergonomics in mind, the markdown file has three problems:

1. **Read-modify-write on one file is racy and token-heavy.** Each persona re-reads the entire file just to find its inbox.
2. **Formatting drifts.** A model writing `* [open]` instead of `- [OPEN]` quietly disappears from any future regex.
3. **No separation between "open inbox" and "resolved history".** The persona's reading load grows forever.

A structured inbox with three tools is cheaper to maintain, easier to query, and harder to corrupt.

## Files (new)

- `tools/inbox_post.py`
- `tools/inbox_read.py`
- `tools/inbox_resolve.py`
- (storage) `projects/<active>/.orchestrator/inbox/<role>.jsonl` — created on first write.

## Tool signatures

```python
inbox_post(to: str, body: str) -> {"id": str}
inbox_read(status: Literal["open", "all"] = "open") -> list[InboxItem]
inbox_resolve(id: str, note: str) -> {"ok": bool}
```

`inbox_read` always returns *only the active persona's* items — the model never names itself. The orchestrator knows which persona is active.

## Record shape

Append one JSON line per event (post or resolve). State is reconstructed by replay; the file is append-only.

```json
{ "kind": "post", "id": "01HF...", "from": "Architect", "to": "Developer",
  "created": "2026-05-22T19:30:00Z", "body": "Constructor injection only for repository ports." }
{ "kind": "resolve", "id": "01HF...", "by": "Developer",
  "resolved": "2026-05-22T20:01:00Z", "note": "Done in commit abc123." }
```

Use ULIDs for IDs (sortable + short). Use UTC ISO-8601 timestamps.

## Validations

- `to` must be a known persona. Reject with a structured error the model can recover from.
- `inbox_resolve` on an already-resolved or unknown id returns a structured error, doesn't raise.
- A persona resolving an item it didn't receive: allow but record `by`. The "for which role" is the `to` field of the original post.

## Persona prompts

After this lands, each `rules/personas/<role>.md` should stop referring to `AGENT_NOTES.md` and instead reference `inbox_read` / `inbox_post` / `inbox_resolve`. Plan to update those prompts as part of this task.

## Optional follow-up (don't do here)

A read-only `AGENT_NOTES.md` rebuilt from the inbox store on each write so the user can read it in an editor. Punt to task **05a** (not yet created) — only worth doing if the user actually wants the human-readable view.

## Acceptance

- Architect calls `inbox_post(to="Developer", body="...")`; Developer calls `inbox_read()` on next phase start and sees it.
- Developer calls `inbox_resolve(id, note)`; a subsequent `inbox_read("open")` returns an empty list; `inbox_read("all")` shows the resolution.
- Storage survives a session restart (it's just JSONL on disk).
