> **Status:** ✅ Completed (2026-07-04) · **Revised 2026-07-10** — format changed from a single `.orchestrator/backlog.json` to a **committed `backlog/` tree of Markdown files** (YAML frontmatter for status/order/depends_on). This doc now describes the current (.md-tree) decision; the JSON schema is retired.

# 09 — Task-backlog format

**Version:** V1
**Depends on:** V1/03 (the planning phases write it via `write_file`/`edit_file`), V1/07 (the scaffold creates `backlog/`).
**Blocks:** V1/08 (planning phases must reference this shape) and V1/10 (Worker + execution trigger consume it).

## Why

CLAUDE.md leaves **"Task backlog format/location"** open. This task **decides and documents** it: where the Epic→Story→Task hierarchy with per-task status lives in the project repo, and the exact shape the Worker and the execution trigger consume. Everything downstream in V1 reads from this decision.

## Recommendation (decided here)

Store the backlog as a **tree of Markdown files under `backlog/`** at the project root (relative to `/workspace`) — human-browseable and **committed** (the plan and its progress are version-controlled), machine-read by the orchestrator (execution trigger + Worker seeding) and machine-written by the planning phases via the file tools.

Rationale:
- **Markdown files, not one JSON blob.** The plan is meant to be read, reviewed, and committed by the human. A tree of `.md` files renders in any editor/Git host; a single JSON file does not. A local model writing one small `.md` per task via `write_file` is more reliable than emitting one large valid JSON document.
- **The path IS the identity.** Epic→Story→Task nest as folders/files, so no id bookkeeping is needed in the file body — a task's id is its path under `backlog/` without `.md`.
- **Committed (not `.orchestrator/`).** Unlike the old JSON (session state), the `.md` backlog is committed alongside `PRODUCT_SPEC.md`; task status flips in each file's frontmatter as execution runs, giving a git-visible progress trail. `PRODUCT_SPEC.md` stays the narrative; `backlog/` is the ordered executable list.

## Format

```
backlog/
  README.md                      # backlog overview (scaffolded); a README.md is NEVER a task
  epic-<slug>/                   # optional epic folder
    README.md                    # epic level documentation
    story-<slug>/                # optional story folder
      README.md                  # story level documentation
      01-<slug>.md               # a TASK (required leaf)
  02-<slug>.md                   # a task with no epic/story is allowed
```

- **Only task files are required.** Epic and story folders are optional grouping — a task may sit directly in `backlog/`, or under an epic, or under an epic + story. Max three levels (epic/story/task).
- A file named **`README.md`** documents its level and is never a task. **Every other `.md` is a task.**

Each **task file** is YAML frontmatter + a Markdown body:

```markdown
---
status: pending          # pending | in_progress | done | blocked  (ALWAYS pending on creation)
order: 1                 # global execution-sequence integer across the whole backlog
depends_on: []           # task ids that must be done first, e.g. [epic-auth/story-signup/00-scaffold]
---
# Short task title

The full definition the Worker is seeded with: what to build, plus constraints.

## Acceptance
The observable signal of done (e.g. "npm test passes the hashing spec").
```

### ID scheme

- A task's **id is its path under `backlog/` without `.md`** — e.g. `epic-auth/story-signup/01-add-hashing-test`.
- `depends_on` entries are these same ids.
- Ids are **stable** (the audit log, statuses, and Worker seeding key off them). Re-running Breakdown appends/edits — it does not rename existing task files.

### Ordering / priority

- `order` (frontmatter integer) is a **global** execution sequence across the whole backlog (Breakdown owns it — dependencies first, then value). The execution trigger (V1/10) iterates tasks sorted by `order`. If `order` is omitted, a leading number in the filename (`01-…`) is used as a fallback.
- `depends_on` is a hard constraint: a task is not eligible to run until every id it lists is `done`. `order` must be consistent with `depends_on`.

### Status states

`pending` → `in_progress` → `done`, plus `blocked`:

| State | Meaning | Who sets it |
|---|---|---|
| `pending` | not yet attempted | Breakdown (on creation) |
| `in_progress` | the execution trigger has handed it to a Worker window | execution trigger (V1/10) |
| `done` | the Worker finished and the **user** reviewed + git-committed it | the user / trigger after user confirms (V1 has no auto-Reviewer) |
| `blocked` | cannot proceed (dependency unmet, or — in V2/V3 — a raised blocker) | trigger / later the Reviewer |

In V1 the transition to `done` is **user-gated**. The trigger marks `in_progress` when it spawns the Worker; the user confirms `done` after reviewing. `blocked` stays in the enum even though V1 only surfaces unmet dependencies (V3 reuses it for `raise_blocker`).

## Files

- `src/core/session/backlog.ts` — `readBacklog(projectPath)` (scans the `backlog/` tree, parsing each non-`README.md` `.md` into a `Task`), `setTaskStatus(projectPath, taskId, status)` (surgically rewrites one file's frontmatter `status`), `nextRunnableTasks(backlog)` (sorted by `order`, dependencies satisfied), `allTasks`/`findTask`, `levelDocs` (epic/story README bodies for the Worker slice), `backlogRoot`, `BacklogError`. Frontmatter parsed with `js-yaml`. Typed `Backlog`/`Task` (no `any`).
- `src/core/session/types.ts` — the `Backlog`/`Task` types and the `TaskStatus` union (path-based `id`, `body`, `dependsOn`, `order`, `status`, `epic`/`story` slugs).
- `src/interface/commands/project-templates.ts` + `new-project.ts` — the scaffold creates `backlog/` with a `README.md` explaining the format.
- Consumed by V1/10 (execution trigger + Worker seeding); written by V1/08 planning phases through `write_file`/`edit_file` under `backlog/`.

## Notes / pitfalls

- **Phases write these files via the model's `write_file`/`edit_file` tools** (paths under `backlog/`, relative to `/workspace`). The orchestrator reads them host-side. Malformed frontmatter → a clear typed `BacklogError` surfaced to the user (hint the Breakdown phase to rewrite), not a crash.
- **`backlog/` is COMMITTED** — do not add it to the project `.gitignore` (only `.orchestrator/` is ignored). Status changes are intentional git diffs.
- **`README.md` is reserved** as the per-level documentation file; a task must never be named `README.md`.
- **IDs are load-bearing and stable** — the Worker is seeded by task id; the audit and statuses reference it.
- This is the **resolution of a CLAUDE.md open question** — once merged, update CLAUDE.md's open-questions list in a separate change.

## Acceptance

- After Discovery→Design→Breakdown on a fresh project, `projects/<active>/backlog/` contains at least one task `.md` with frontmatter `status: pending` + `order`, and any epic/story folders carry a `README.md`.
- `nextRunnableTasks(readBacklog(...))` returns tasks in `order`, excluding any whose `depends_on` aren't `done`.
- `setTaskStatus(..., "epic-x/story-y/01-task", "in_progress")` flips exactly that file's frontmatter status; re-reading shows the new status; other tasks and the rest of the file (order, depends_on, body) unchanged.
- Hand-corrupt a task's frontmatter → `readBacklog` returns a clear typed error, the app surfaces it, and nothing crashes.
