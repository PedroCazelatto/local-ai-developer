> **Status:** ⬜ Not started

# 04 — Per-phase memory persistence (`/clear` and `/resume`)

**Version:** V4
**Depends on:** Foundation/06 (phase abstraction + per-phase isolated in-RAM histories), Foundation/03 (Ollama client returning exact `prompt_eval_count`/`eval_count`).
**Blocks:** V4/05 (the summarization failsafe writes/reads `summary` records into this same JSONL).

## Why

The phase abstraction (Foundation/06) holds each phase's history in RAM only — closing `run start` loses every phase's context. CLAUDE.md ("Memory model") requires **per-project persistence so the model always knows where it stopped**, plus a manual `/clear` and the user-owned decision to wipe history. Sessions here span hours or days, so restart-with-resume is table stakes. This task adds the on-disk layer and the `/clear` + `/resume` commands on top of it.

## Behavior

### Storage layout

Per CLAUDE.md, all per-project state lives under `projects/<active>/.orchestrator/`:

```
projects/<active>/.orchestrator/memory/
  <phase>.jsonl                      # active append-only history for that phase
  archive/
    <phase>-<ts>-<ulid>.jsonl        # one archive per /clear (or per /resume swap-out)
```

One active JSONL per phase, **append-only**. Files are named by **phase** id (`discovery.jsonl`, `worker.jsonl`, …) — never `<role>.jsonl`. Nothing is ever deleted; `/clear` moves the active file into `archive/`.

### Record shape

Each line is one turn:

```json
{
  "id": "01HF...",
  "ts": "2026-06-21T19:30:00Z",
  "role": "user",
  "content": "...",
  "tool_calls": [ /* present only when role=assistant and the turn issued tool calls */ ],
  "tool_name": "read_file",
  "tokens": { "prompt": 1842, "completion": 273 }
}
```

- `id` — a **ULID** (sortable, collision-free), generated per record.
- `ts` — ISO-8601 UTC.
- `role` — one of `user | assistant | tool | summary`. (`summary` is written by V4/05; this task's loader must already know to handle it.)
- `content` — the text of the turn.
- `tool_calls?` — optional; the assistant's issued tool calls when present.
- `tool_name?` — optional; for `role: "tool"` records, which tool produced the result.
- `tokens` — `{ prompt: number | null, completion: number | null }`, sourced **exactly** from the Ollama response (`prompt_eval_count` → `prompt`, `eval_count` → `completion`). If a call did not report a metric, write `null`. **Never estimate** from string/char length — a length-based token heuristic is forbidden anywhere in this repo.

```ts
type MemoryRole = "user" | "assistant" | "tool" | "summary";
interface MemoryRecord {
  id: string;            // ULID
  ts: string;            // ISO-8601 UTC
  role: MemoryRole;
  content: string;
  tool_calls?: ToolCall[];
  tool_name?: string;
  tokens: { prompt: number | null; completion: number | null };
  replaces?: string[];   // present only on role:"summary" — see V4/05
}
```

### Loading (on phase activation only)

When a phase becomes active (replaces `set_active_persona` — call it e.g. `activatePhase(phase)`):

1. If `<phase>.jsonl` exists, read it and rebuild the in-memory turn history for that phase.
2. If not, start empty (the file is created on first append).
3. When a `summary` record is encountered, the turns it `replaces` are skipped in the in-memory view — see V4/05 for the exact filter. This task's loader must implement the skip-by-`replaces`-id walk so V4/05 only adds the *writing* side.
4. **Load lazily** — only the phase that just became active. Don't read every phase's JSONL at boot. (No parallelism, single active phase — CLAUDE.md.)

The system prompt is **not** persisted here — it is re-seeded from `rules/phases/<phase>.md` on activation (V1/01). Only conversational turns live in the JSONL.

### `/clear` (active phase only, no confirmation)

1. Move `<phase>.jsonl` → `archive/<phase>-<ts>-<ulid>.jsonl` (ts + ULID so rapid clears never collide).
2. Reset the active phase's in-memory history to empty.
3. Print one line: `Cleared <Phase> · archived (use /resume to restore)`.

Other phases are untouched. Nothing is destroyed — the archive is the source of truth for `/resume`.

### `/resume` (active phase only — mirrors `/clear`)

1. List the **last 3 archives** for the active phase, most recent first.
2. For each, show a summary **derived directly from the JSONL — no LLM call, no cost**:
   - archive timestamp (local time);
   - turn count;
   - first user message (truncated ~80 chars);
   - last user message (truncated ~80 chars);
   - total tokens = sum of `tokens.prompt + tokens.completion` across the file (treat `null` as 0 for the display total).
3. Prompt: `Pick 1-3 to restore, anything else to cancel:`.
4. On a valid pick: move the chosen archive back to `<phase>.jsonl` and reload it into memory; the previously-active file (likely the empty one created since the last clear) is moved into `archive/` under a fresh `<phase>-<ts>-<ulid>.jsonl` so it can be `/resume`d again later.
5. No archives → print `No archives for <Phase>` and return.

Example:

```
Archives for Worker (most recent first):

  1) 2026-06-21 21:14 · 47 turns · 18,432 tokens
     "implement the auth endpoint with refresh tokens..."
     → "all tests passing, ready for review"

  2) 2026-06-19 18:03 · 23 turns · 7,108 tokens
     "let's start the user model from scratch"
     → "blocked on schema decision, need user input"

Pick 1-3 to restore, anything else to cancel:
```

## Files

- `src/core/session/memory.ts` — the port of the old `memory.py`: per-phase in-RAM history backed by append-only JSONL. Append on each turn; rebuild on activation. Keyed by **phase**, not role/persona.
- `src/core/session/memory-store.ts` (or fold into the above) — JSONL read/write, archive moves, ULID + ts naming, the load-time `replaces` skip walk.
- `tools/clear.ts` (or a command module) — `/clear` command, active phase only, no confirm.
- `tools/resume.ts` (or a command module) — `/resume` command, last-3 listing + restore. Summaries derived from JSONL only.
- `src/core/session/orchestrator.ts` — wire `activatePhase` to load the JSONL; route `/clear` and `/resume` to the active phase.

## Notes / pitfalls

- **Tokens are exact.** Persist `prompt_eval_count`/`eval_count` verbatim; `null` when a metric is genuinely absent. No `content.length`-style estimate anywhere — grep the code after; it must come up empty.
- **Phase vocabulary only.** File names, type names, and the activation function use `phase` — not `<role>.jsonl`, not `set_active_persona`. (CLAUDE.md flags the legacy Python identifiers; do not carry them into TS.)
- **Append-only.** Never rewrite or truncate `<phase>.jsonl` in place; `/clear` *moves* it, V4/05 *appends* a summary. The archive is the only durable record for `/resume`.
- **`/resume` does no LLM call.** First/last user message + token totals come straight from the file. (Contrast V4/05's *failsafe* summary, which does spawn a throwaway call — different mechanism.)
- **Lazy load.** Only the active phase's JSONL is read into RAM (VRAM/RAM frugality; single active phase, no parallelism).
- **Single-process, single-active-phase → no locking needed.** Document this assumption so it isn't violated later.
- Storage is under the **project** repo's `.orchestrator/`, not the orchestrator repo.

## Acceptance

- Run a Worker turn, exit `run start`, restart with the same project, activate `worker` → the previous turn is back in context (read from `worker.jsonl`).
- `/clear` on the active phase archives `<phase>.jsonl` into `archive/` with a `<phase>-<ts>-<ulid>.jsonl` name and resets in-memory; other phases' files are untouched.
- `/resume` lists up to 3 archives with the timestamp / turn count / first+last user message / total-tokens summary above, and restores the chosen one.
- `/clear` then immediately `/resume` → pick 1 → in-memory state matches exactly what it was before the clear.
- Inspect a written record: `tokens.prompt`/`tokens.completion` equal the Ollama response's `prompt_eval_count`/`eval_count` for that turn (or `null`), never a computed estimate.
- No `<phase>.jsonl` grows unbounded mid-session once V4/05 lands.
