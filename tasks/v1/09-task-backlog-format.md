> **Status:** ⬜ Not started

# 09 — Task-backlog format

**Version:** V1
**Depends on:** V1/03 (the planning phases write it via `write_file`/`edit_file`), V1/07 (the scaffold creates `.orchestrator/`).
**Blocks:** V1/08 (planning phases must reference this shape) and V1/10 (Worker + execution trigger consume it).

## Why

CLAUDE.md leaves **"Task backlog format/location"** open. This task **decides and documents** it: where the Epic→Story→Task hierarchy with per-task status lives in the project repo, and the exact shape the Worker and the execution trigger consume. Everything downstream in V1 reads from this decision.

## Recommendation (decided here)

Store the backlog as **`projects/<active>/.orchestrator/backlog.json`** — a single structured JSON file, machine-read by the orchestrator (execution trigger + Worker seeding) and machine-written by the planning phases via the file tools.

Rationale:
- **JSON, not prose in `PRODUCT_SPEC.md`.** The execution trigger (V1/10) needs to enumerate tasks, read statuses, and pick "one/some/all" deterministically. Parsing that out of free-form markdown is fragile; a local model writing valid JSON via `write_file` is reliable enough and trivially machine-read.
- **`.orchestrator/` (gitignored), not the repo body.** The backlog is orchestrator session state (statuses flip as execution runs), consistent with `tool_audit.jsonl` and `memory/`. The human-readable narrative (vision, epics, architecture prose) stays in `PRODUCT_SPEC.md`, which **is** committed. The backlog is the operational index over that narrative.
- **One file.** Epics/Stories/Tasks nest naturally; no need to spread across files in V1.

`PRODUCT_SPEC.md` and `backlog.json` are complementary: `PRODUCT_SPEC.md` is the *why/what* for humans and phase context; `backlog.json` is the *ordered executable list* for the loop.

## Schema

```jsonc
{
  "version": 1,
  "epics": [
    {
      "id": "E1",
      "title": "User Authentication",
      "stories": [
        {
          "id": "E1-S1",
          "title": "Email/password sign-up",
          "tasks": [
            {
              "id": "E1-S1-T1",
              "title": "Add failing test for password hashing",
              "description": "Full task definition the Worker is seeded with: what to build, acceptance criteria, constraints.",
              "acceptance": "Observable signal of done (e.g. 'npm test passes the hashing spec').",
              "depends_on": ["E1-S1-T0"],   // task ids that must be `done` first; [] if none
              "order": 1,                     // sequence index within the backlog
              "status": "pending"             // see status states
            }
          ]
        }
      ]
    }
  ]
}
```

### ID scheme

- Epic: `E<n>` (`E1`, `E2`, …).
- Story: `<epicId>-S<n>` (`E1-S1`).
- Task: `<storyId>-T<n>` (`E1-S1-T1`).
- IDs are **stable** once assigned — the audit log, statuses, and Worker seeding all key off them. Re-running Breakdown appends/edits but does not renumber existing tasks.

### Ordering / priority

- `order` is a global integer across the whole backlog giving the **execution sequence** (Breakdown owns it — dependencies first, then value, per `rules/phases/breakdown.md`). The execution trigger (V1/10) iterates tasks sorted by `order`.
- `depends_on` is a hard constraint: a task is not eligible to run until every id it lists is `done`. `order` must be consistent with `depends_on` (a task never ordered before something it depends on) — Breakdown enforces this when writing.

### Status states

`pending` → `in_progress` → `done`, plus `blocked`:

| State | Meaning | Who sets it |
|---|---|---|
| `pending` | not yet attempted | Breakdown (on creation) |
| `in_progress` | the execution trigger has handed it to a Worker window | execution trigger (V1/10) |
| `done` | the Worker finished and the **user** reviewed + git-committed it | the user / trigger after user confirms (V1 has no auto-Reviewer) |
| `blocked` | cannot proceed (dependency unmet, or — in V2/V3 — a raised blocker) | trigger / later the Reviewer |

In V1 the transition to `done` is **user-gated** (the user reviews and commits — no automated Reviewer). The trigger marks `in_progress` when it spawns the Worker; the user confirms `done` after reviewing. Keep `blocked` in the enum now even though V1 only sets it for unmet dependencies (V3 reuses it for `raise_blocker`).

## Files

- `src/core/session/backlog.ts` — `readBacklog(projectPath)`, `writeBacklog(projectPath, backlog)`, `setTaskStatus(projectPath, taskId, status)`, `nextRunnableTasks(backlog)` (sorted by `order`, dependencies satisfied). Typed `Backlog`/`Epic`/`Story`/`Task` interfaces (no `Any`).
- `src/core/session/types.ts` — the `Backlog`/`Task` types and the `TaskStatus` union.
- Consumed by V1/10 (execution trigger + Worker seeding); written by V1/08 planning phases through `write_file`/`edit_file` on `.orchestrator/backlog.json`.

## Notes / pitfalls

- **Phases write this file via the model's `write_file`/`edit_file` tools** (path `.orchestrator/backlog.json`, relative to `/workspace`). The orchestrator reads it host-side with `readBacklog`. Validate on read: malformed JSON → a clear error surfaced to the user (and a hint the planning phase should rewrite it), not a crash.
- **`.orchestrator/` is gitignored (V1/07)** — the backlog is session state. The committed artifact is `PRODUCT_SPEC.md` + the actual code.
- **IDs are load-bearing and stable** — the Worker is seeded by task id; the audit and statuses reference it.
- **`order` consistent with `depends_on`** — the trigger trusts `order` for the run sequence but must still skip a task whose `depends_on` aren't `done` (defense in depth).
- This is the **resolution of a CLAUDE.md open question** — once merged, update CLAUDE.md's open-questions list in a separate change (not part of this task's file edits).

## Acceptance

- After Discovery→Design→Breakdown on a fresh project, `projects/<active>/.orchestrator/backlog.json` parses against the schema: at least one epic, with stories, with tasks carrying `id`, `description`, `acceptance`, `order`, `status: "pending"`.
- `nextRunnableTasks(readBacklog(...))` returns tasks in `order`, excluding any whose `depends_on` aren't `done`.
- `setTaskStatus(..., "E1-S1-T1", "in_progress")` flips exactly that task; re-reading shows the new status; other tasks unchanged.
- Hand-corrupt the JSON → `readBacklog` returns a clear typed error, the app surfaces it, and nothing crashes.
