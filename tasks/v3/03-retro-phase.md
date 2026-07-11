> **Status:** ✅ Completed (2026-07-11)

# 03 — Retro phase (patch the right file after a blocker)

**Version:** V3
**Depends on:** V3/02 (a resolved blocker is what triggers Retro), V2/03 (commit tool + auto-commit policy), V1/01 (phase-instruction loader), V3/04 (Retro reads/writes inbox notes, optional)
**Blocks:** nothing (closes the V3 learning loop)

## Why

CLAUDE.md "Retro phase": *"When the user answers a blocker, the orchestrator spawns a Retro window with `{the task, the misunderstanding, the user's answer}`. It diagnoses what went wrong and where, then patches the correct file so the mistake does not recur."* The classification decides which file is touched: **systemic** gaps edit a **global** phase file under `rules/phases/` (left **uncommitted** + the user is warned it must be reviewed before continuing); **task-specific** gaps edit the **project doc** only. This enforces the git policy invariant: *"The orchestrator's own instruction set must never mutate silently."* The Retro phase prompt already exists at `rules/phases/retro.md` — this task wires the orchestration around it.

## Behavior

### Trigger + inputs

When the user resolves a blocker (V3/02 records the answer), the orchestrator spawns a **fresh, empty** Retro window:

```ts
spawnRetro(input: RetroInput) -> RetroResult

interface RetroInput {
  task: TaskDefinition;       // the task that blocked
  misunderstanding: string;   // the blocker question (what the Reviewer was confused about)
  answer: string;             // the user's resolving answer
}
```

System prompt = `rules/phases/retro.md` (loaded by V1/01). The user turn carries `{ task, misunderstanding, answer }`. Retro runs a short reasoning turn, then makes **exactly one** file edit via the existing file tools, scoped per its classification.

### Classification → which file

Per `rules/phases/retro.md`:

- **Systemic** — a question the protocol should always ask, or a check the Reviewer should always run (it *should* have been caught in Discovery / Design / Review). → edit the relevant **global phase file** under `rules/phases/` (e.g. `discovery.md`, `design.md`, `breakdown.md`, `reviewer.md`).
- **Task-specific** — a one-off gap in this task's wording or acceptance criteria. → edit the **project doc** only (the task entry in the backlog, or `PRODUCT_SPEC.md`).

Retro must touch **one** file. If it seems to belong in two places, that signals a mis-classification — the prompt already tells it to re-check.

### Result + the commit invariant

```ts
type RetroScope = "systemic" | "task-specific";

interface RetroResult {
  scope: RetroScope;
  rootCause: string;             // one-sentence diagnosis
  editedFile: string;            // absolute repo path of the single file patched
  committed: boolean;            // true only for task-specific edits
  reviewWarning?: string;        // present when scope === "systemic"
}
```

- **Task-specific** edit → committed with the project's work via the V2/03 commit flow. `committed: true`.
- **Systemic** edit (any file under `rules/phases/`) → **never auto-committed.** Leave it in the working tree uncommitted, set `committed: false`, and return a `reviewWarning`. The orchestrator surfaces this prominently and **pauses before continuing the loop** until the user has reviewed and committed the global change manually.

The orchestrator must enforce the path guard itself, not trust the model: any edit whose target resolves under `rules/phases/` is forced down the uncommitted-and-warn path regardless of what the model claims its scope is.

## Files

- `src/phases/retro.ts` — new; `spawnRetro` (fresh window, loads `rules/phases/retro.md`, runs the turn, returns `RetroResult`); discarded after it returns (one-shot, like Worker/Reviewer spawns).
- `src/core/session/orchestrator.ts` — touched; on blocker resolution, call `spawnRetro({ task, misunderstanding, answer })`; route the result — commit task-specific via V2/03, or surface the systemic review-warning and pause.
- `src/core/session/commit.ts` (the V2/03 commit tool) — touched/reused; must refuse to stage anything under `rules/` so a global instruction edit can never ride along in an auto-commit (defense in depth behind the orchestrator path guard).
- `src/core/ui/*` — touched; render the root-cause line, the file patched, and (for systemic) the loud "review the uncommitted `rules/phases/...` change before continuing" warning.
- `rules/phases/retro.md` — **do not rewrite** (it already encodes the mission, classification, and commit rule). Touch only if a wording gap surfaces during wiring; otherwise leave as-is.

## Notes / pitfalls

- **The global-instruction commit invariant is the whole point.** A systemic edit under `rules/phases/` must end up uncommitted with a user warning — no exceptions, no "small change so I'll just commit it." Guard by resolved path, not by the model's self-declared scope.
- **One file per Retro.** Two edits = mis-classification. The orchestrator should detect (and reject) a Retro turn that edits more than one file, prompting it to re-classify.
- **Fresh, isolated window.** Retro starts from empty history (CLAUDE.md memory model: spawned windows start empty and are discarded). It sees only `{task, misunderstanding, answer}` — never the Worker's or Reviewer's internal turns.
- **`rules/` is the orchestrator repo, not the project repo.** A systemic edit changes the orchestrator's own instruction set in *this* repo's working tree; a task-specific edit changes a file inside `projects/<active>/`. Don't cross the streams — the path guard distinguishes them.
- **Pause, don't proceed, on a systemic patch.** After warning, the loop/batch must not silently continue past an uncommitted global change. The user commits it manually, then continues.
- Tokens for the Retro turn are read exactly from Ollama and logged; the Retro tool calls are audited (V1/06) like any other.

## Acceptance

- In a live session, raise and resolve a blocker whose answer reveals a **task-specific** wording gap. Retro classifies `task-specific`, patches the task entry in the project backlog, and the edit is committed with the project's work — `RetroResult.committed === true`.
- Raise and resolve a blocker whose answer reveals a **systemic** gap (e.g. Discovery should always have asked X). Retro classifies `systemic`, patches the matching `rules/phases/<phase>.md`, leaves it **uncommitted**, returns a `reviewWarning`, and the UI loudly tells the user to review-and-commit before continuing — `committed === false`, and `git status` shows the modified `rules/phases/...` file unstaged.
- A Retro turn that attempts to commit a `rules/phases/` edit is blocked by the commit guard (the file stays unstaged) — verifying the invariant holds even if the model misbehaves.
- A Retro turn that edits two files is rejected and re-prompted to pick one.
- The Retro window is fresh (no Worker/Reviewer history) and discarded after returning.
