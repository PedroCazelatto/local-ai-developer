# 08 — Per-persona memory persistence (`/clear` and `/resume`)

**Milestone:** M4 — Persistence

## Why

`core/session/memory.py` (29 lines) holds per-persona history in RAM only. Closing `main.py` loses every persona's context. For sessions that span hours or days — the realistic shape of this project — restart-with-resume is table stakes. This task adds the persistence layer and the `/clear` + `/resume` commands that sit on top of it.

## Storage layout

```
projects/<active-project>/.orchestrator/memory/
  <role>.jsonl                    # active history per persona
  archive/
    <role>-<ts>-<ulid>.jsonl      # one archive per /clear
```

One active JSONL per persona, append-only. Each `/clear` moves the active file into `archive/` with a timestamp. Nothing is deleted.

## Record shape

Each line in `<role>.jsonl` is one turn:

```json
{
  "id": "01HF...",
  "ts": "2026-05-22T19:30:00Z",
  "role": "user" | "assistant" | "tool" | "summary",
  "content": "...",
  "tool_calls": [...],
  "tool_name": "read_file",
  "tokens": { "prompt": 1842, "completion": 273 }
}
```

Token values come from Ollama's response (`prompt_eval_count`, `eval_count`) — see CLAUDE.md's token-accuracy rule. Never estimate. If a call didn't report a metric (rare), write `null`, don't substitute.

## Loading

On `set_active_persona(role)`:

1. If `<role>.jsonl` exists, read it and rebuild the in-memory history.
2. If not, start empty (the file is created on first write).
3. If a `summary` record appears, it replaces the turns it covers — see task 09 for the exact mechanism.

Don't load *all* personas at startup — only when a persona becomes active. Saves RAM.

## `/clear` semantics

`/clear` operates on the **active persona only**. No confirmation prompt — instant.

Behavior:

1. Move `<role>.jsonl` to `archive/<role>-<ts>-<ulid>.jsonl`. Use timestamp + ULID so concurrent or rapid clears never collide.
2. In-memory history for that persona resets to empty.
3. Print a one-line confirmation: `Cleared <Persona> · archived (use /resume to restore)`.

Other personas are untouched. Nothing is destroyed; the archive is the source of truth for `/resume`.

## `/resume` semantics

`/resume` also operates on the **active persona only** (matches `/clear`).

Behavior:

1. List the **last 3 archives** for the active persona, most recent first.
2. For each, show a short summary:
   - Archive timestamp (local time).
   - Turn count.
   - First user message (truncated to ~80 chars).
   - Last user message (truncated to ~80 chars).
   - Total tokens (sum of `tokens.prompt + tokens.completion` across the file).
3. Prompt the user: `Pick 1-3 to restore, anything else to cancel:`.
4. On selection: move the chosen archive back to `<role>.jsonl`, reload into memory. The previously-active (likely empty) file goes back into `archive/` under a new name so it can also be `/resume`d later.
5. If there are no archives, print `No archives for <Persona>` and return.

The summaries are derived directly from the JSONL — **no LLM call**, no extra cost. First-and-last user messages plus token totals are enough signal for the user to recognize which session was which.

Example output:

```
Archives for Developer (most recent first):

  1) 2026-05-22 21:14 · 47 turns · 18,432 tokens
     "implement the auth endpoint with refresh tokens..."
     → "all tests passing, ready for review"

  2) 2026-05-20 18:03 · 23 turns · 7,108 tokens
     "let's start the user model from scratch"
     → "blocked on schema decision, need user input"

  3) 2026-05-19 22:30 · 12 turns · 3,209 tokens
     "let me explain the project"
     → "ok, sounds good"

Pick 1-3 to restore, anything else to cancel:
```

## Concurrency

Single-process, single-active-persona at a time — no locking needed. Document this assumption so it doesn't get violated quietly later.

## Acceptance

- Run a Developer turn, exit `main.py`, restart with the same project, `/swap developer` → the previous turn is in context.
- `/clear` archives the active file and resets in-memory; the JSONL appears under `archive/` with a timestamped name.
- `/resume` lists up to 3 archives with the summaries above and restores the chosen one.
- `/clear` followed immediately by `/resume` → pick 1 → state matches what it was before the clear.
- No JSONL grows unbounded mid-session without task 09 (summarization).
