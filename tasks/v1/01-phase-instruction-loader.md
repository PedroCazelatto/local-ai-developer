> **Status:** ✅ Completed (2026-07-04)

# 01 — Phase-instruction loader

**Version:** V1
**Depends on:** Foundation/06 (phase abstraction + per-phase isolated histories), Foundation/03 (Ollama client `chat`/`stream`).
**Blocks:** every phase behaving distinctly (V1/08 planning content, V1/10 Worker) — without this, all phases share one undifferentiated prompt.

## Why

A phase *is* an instruction set loaded into a context window (CLAUDE.md, "Core mental model"). The six phase files already exist under `rules/phases/{discovery,design,breakdown,worker,reviewer,retro}.md`. This task wires them in: when a phase activates, its markdown becomes the **system prompt** for that phase's window. Without it, swapping phases changes a label but not the model's behavior.

## Behavior

- On phase activation (session start with an initial phase, and on `/swap <phase>`), read `rules/phases/<phase>.md` from the orchestrator repo (UTF-8) and use its full contents as the **system message** (role `system`) for that phase's window.
- The system message is the **first** entry in the phase's `messages` array — index 0 — and is never duplicated. It is **not** counted as conversational history: `/clear` (later) wipes turns but the system prompt is always re-seeded from disk.
- The phase name → file path map is `rules/phases/${phaseName}.md` where `phaseName` is the lowercase canonical phase id (`discovery`, `design`, `breakdown`, `worker`, `reviewer`, `retro`).
- If the file is missing or unreadable, fail loudly at activation time with a clear error naming the expected path — do **not** fall back to an empty or generic prompt (a silently prompt-less phase is the bug this task prevents).
- The file is read **fresh on every activation** (not cached at boot), so editing a phase markdown and re-swapping picks up the change without restarting `run start`.

### Composition with per-phase isolated histories (Foundation/06)

Foundation/06 gives each phase its own `messages` array and swaps the active array on `/swap` with **no cross-phase leakage**. This task defines how the system prompt sits inside that model:

- Each phase's array is `[systemMessage, ...turns]`. The `systemMessage` is owned by this loader; `turns` are owned by the history/memory layer.
- Switching away saves the active phase's `turns`; switching in loads the target phase's `turns` and **re-prepends** the freshly-read system prompt. Two phases never see each other's system prompt or turns.
- Spawned execution windows (Worker, later Reviewer/Retro) are fresh empty arrays that get the relevant phase markdown as their system prompt the same way — see V1/10.

## Files

- `src/context/phase-prompt.ts` — `loadPhasePrompt(phaseName: string): string`; reads `rules/phases/<phase>.md`, throws a typed error on miss. Resolves the rules dir relative to the orchestrator repo root, not the active project.
- `src/core/session/phase.ts` (or wherever Foundation/06 put the phase abstraction) — call `loadPhasePrompt` on activation and seed `messages[0]`.
- `src/core/session/orchestrator.ts` — the `/swap` path re-seeds the system prompt for the target phase.

## Notes / pitfalls

- **Rules are global, read from the orchestrator repo** — never from `projects/<active>/`. Projects are agnostic to the orchestrator (CLAUDE.md, "Rules loading"). Resolve the path against the orchestrator install dir.
- **No persona/role naming.** The map keys and any types are `phase`/`phaseName`. (CLAUDE.md notes the legacy Python identifiers — do not carry them into TS.)
- The system prompt does **not** carry tool docs — tools are sent separately via the Ollama `tools` array (V1/02). The markdown only *steers* tool usage in prose.
- Re-reading on every activation is intentional: it lets V1/08 iterate on planning-phase content live.

## Acceptance

- `run start hello-world` boots into the default phase; inspecting the outgoing Ollama request (log it during a scripted check) shows `messages[0].role === "system"` and its content equals `rules/phases/discovery.md` byte-for-byte.
- `/swap worker` then a turn: the system prompt is now `worker.md`; the previous phase's turns are not present.
- Edit one line in `rules/phases/discovery.md`, `/swap design`, `/swap discovery`, send a turn — the edited line is in the system prompt (proves no boot-time caching).
- Rename `worker.md` away and `/swap worker`: activation fails with an error naming the missing `rules/phases/worker.md`, not a blank-prompt turn.
