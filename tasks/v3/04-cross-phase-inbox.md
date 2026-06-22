> **Status:** ⬜ Not started

# 04 — Cross-phase inbox (replaces `AGENT_NOTES.md`)

**Version:** V3
**Depends on:** V1/02 (tool registry + dispatch — tools must be reachable by the model), V1/06 (tool audit log)
**Blocks:** nothing — but the phase prompts under `rules/phases/` should switch to these tools (see Files)
**Supersedes** the `AGENT_NOTES.md` markdown-file mechanism described in CLAUDE.md.

## Why

CLAUDE.md "Inter-phase communication" specifies a single shared `AGENT_NOTES.md` with `## To: <Phase>` sections. Because each phase window has its **own isolated history** and never sees another phase's turns, cross-phase signals need a file on disk. But re-reading the design with local-model ergonomics in mind, the markdown file has three problems:

1. **Read-modify-write on one file is racy and token-heavy.** Each phase re-reads the entire file just to find its inbox.
2. **Formatting drifts.** A model writing `* [open]` instead of `- [OPEN]` quietly disappears from any future regex.
3. **No separation between "open inbox" and "resolved history".** A phase's reading load grows forever.

A structured inbox with three tools backed by append-only JSONL is cheaper to maintain, easier to query, and harder to corrupt. (This is the TS + "phase" port of the old `tasks/04-inbox-store-and-tools.md`, which was written for Python + "persona".)

## Behavior

### Signatures

```ts
inbox_post(to: string, body: string) -> InboxPostResult
inbox_read(status: "open" | "all" = "open") -> InboxItem[]
inbox_resolve(id: string, note: string) -> InboxResolveResult
```

```ts
type Phase = "Discovery" | "Design" | "Breakdown" | "Worker" | "Reviewer" | "Retro";

interface InboxItem {
  id: string;          // ULID — sortable + short
  from: Phase;
  to: Phase;
  created: string;     // UTC ISO-8601
  body: string;
  resolved: boolean;
  resolvedAt?: string; // UTC ISO-8601, present when resolved
  resolvedBy?: Phase;
  note?: string;       // resolution note
}

// success
{ ok: true, id: string }                       // inbox_post
InboxItem[]                                     // inbox_read
{ ok: true, id: string }                        // inbox_resolve

// structured, recoverable errors (the model reads and recovers — no throw)
{ ok: false, error: "unknown_to_phase",   message: "..." }   // inbox_post: `to` not a known phase
{ ok: false, error: "empty_body",         message: "..." }   // inbox_post: blank body
{ ok: false, error: "unknown_id",         message: "..." }   // inbox_resolve: no such id
{ ok: false, error: "already_resolved",   message: "..." }   // inbox_resolve: id already resolved
```

`inbox_read` always returns **only the active phase's** items — the model never names itself. The orchestrator knows which phase is active (from the session) and filters `to === <activePhase>`. `status: "open"` returns only unresolved items; `"all"` returns the full history including resolved ones.

### Storage

Append-only JSONL, one file per **recipient** phase:

```
projects/<active>/.orchestrator/inbox/<phase>.jsonl
```

`<phase>` is the lowercased recipient (`worker.jsonl`, `reviewer.jsonl`, …). Created on first write. One JSON line per **event** (post or resolve); state is reconstructed by **replay** (the file is never rewritten in place):

```json
{ "kind": "post",    "id": "01HF...", "from": "Design",  "to": "Worker",
  "created": "2026-06-21T19:30:00.000Z",
  "body": "Constructor injection only for repository ports." }
{ "kind": "resolve", "id": "01HF...", "by": "Worker",
  "resolved": "2026-06-21T20:01:00.000Z", "note": "Done in commit abc123." }
```

`inbox_read` for phase P loads `<P>.jsonl`, replays the events to fold posts + resolves into `InboxItem`s, then filters by `status`. `inbox_post(to=X)` appends a `post` event to `<X>.jsonl`. `inbox_resolve(id)` must locate which recipient file holds `id` (the item lives in the file named after its `to` phase) and append a `resolve` event there.

### Protocol (mirrors the old `AGENT_NOTES.md` convention, now tool-backed)

- **Phase start:** the active phase calls `inbox_read()` and addresses every open item before starting new work.
- **During a phase:** when a phase spots a concern that belongs to another phase, it calls `inbox_post(to, body)`.
- **Resolution:** `inbox_resolve(id, note)` flips an item closed with a one-line note.

## Files (new)

- `src/tools/inbox-post.ts` — `inbox_post` tool definition + handler.
- `src/tools/inbox-read.ts` — `inbox_read` tool; filters to the active phase, applies `status`.
- `src/tools/inbox-resolve.ts` — `inbox_resolve` tool; locates the owning file, appends a resolve event.
- `src/core/session/inbox-store.ts` — append-only JSONL reader/writer + replay-to-`InboxItem` fold, ULID generation, UTC timestamps, phase-name validation; shared by the three tools.

## Files (touched)

- `src/tools/registry.ts` (V1/02) — register the three inbox tools so the model can call them.
- `rules/phases/*.md` — each phase prompt should **stop referring to `AGENT_NOTES.md`** and instead reference `inbox_read` / `inbox_post` / `inbox_resolve` (read your inbox at phase start; post a concern to another phase; resolve with a note). Update all six (`discovery.md`, `design.md`, `breakdown.md`, `worker.md`, `reviewer.md`, `retro.md`) as part of this task.

## Notes / pitfalls

- **Append-only, replay for state.** Never rewrite a JSONL file in place to mark something resolved — append a `resolve` event and fold it on read. This is what keeps the store crash-safe (a killed process can't corrupt prior rows) and survives restarts.
- **The model never names itself.** `inbox_read` derives the active phase from the session, not from a model argument. Don't add a `phase` parameter the model fills in — that reintroduces the drift the markdown file had.
- **Validate `to` against the closed `Phase` set.** An unknown recipient returns `unknown_to_phase`, recoverable — it does not throw and kill the turn.
- **Resolve semantics:** a phase may resolve an item it didn't receive — allow it but record `by` (the resolver) distinctly from the original `to` (the intended recipient). Resolving an unknown or already-resolved id returns a structured error, never an exception.
- **One file per recipient** keeps each phase's read cheap (it loads only its own inbox), directly fixing the token-heavy whole-file re-read of `AGENT_NOTES.md`.
- Every inbox tool call is written to the V1/06 audit log like any other tool.
- ULIDs (not UUIDs): sortable by creation time and shorter, which keeps the lines compact and lets a chronological read fall out of id order. UTC ISO-8601 timestamps throughout.

## Acceptance

- In a live session, the Design phase calls `inbox_post(to="Worker", body="...")`; the Worker calls `inbox_read()` at its next phase start and sees exactly that item (and no items addressed to other phases).
- The Worker calls `inbox_resolve(id, note)`; a subsequent `inbox_read("open")` returns an empty list, while `inbox_read("all")` shows the item with `resolved: true`, `resolvedBy: "Worker"`, and the note.
- `inbox_post(to="Nope", body="x")` returns `{ ok: false, error: "unknown_to_phase" }` and the turn continues. `inbox_resolve("does-not-exist", "n")` returns `{ ok: false, error: "unknown_id" }`. Resolving an already-resolved id returns `already_resolved`.
- The store survives a session restart — it is just JSONL on disk under `projects/<active>/.orchestrator/inbox/`; killing the process mid-write does not corrupt prior rows.
- The six `rules/phases/*.md` files reference the inbox tools and no longer mention `AGENT_NOTES.md`.
