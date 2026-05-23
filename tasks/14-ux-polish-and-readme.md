# 14 — UX polish and README rewrite

**Milestone:** M7 — Polish

Small improvements worth doing once the surface is stable. Do these *last* — they assume the loop, tools, persistence, runtime, and sub-agent story are settled, so the README doesn't need a rewrite three weeks later.

## Status line improvements

`core/ui/renderer.py` already shows project, model, tokens, num_ctx, queue. Additions:

- **Active persona**, in its theme color, persistently on the left. Currently the input line shows it; surfacing it on the status line means the user always sees which persona will receive their next message even when typing.
- **Time since last tool call** — when the model is "thinking" for too long, this surfaces it.
- **Current tool** when one is executing, with elapsed time.
- **Sub-agent count** (from task 12): `Subagents: 2` when any are active; omit when zero.

Token values shown anywhere must come from Ollama (CLAUDE.md rule).

Don't add anything else without a concrete moment where you missed it. Status lines bloat fast.

## Shift+Tab discoverability

`interface/terminal_loop.py` wires Shift+Tab and Ctrl+Shift+Tab for persona cycling. No help text mentions it. Add a one-liner in the input panel footer: *"Shift+Tab: next persona · /swap <name>: jump"*.

## `/help`

No `/help` command exists today. Add one — listing user commands and a one-line description for each. Generate from `CommandFactory` so it stays current as new commands land. Group by purpose (session, memory, models, projects, sub-agents) once the set is large enough to warrant it.

## README rewrite

`README.md` describes the old `orchestrator/` layout and lists commands that don't exist. Once the M1–M6 surface is stable, rewrite it.

Suggested structure:

1. **What it is** — one paragraph. Local Ollama orchestration through manually-driven personas. Learning artifact, not a Cursor replacement.
2. **How a session works** — pull from CLAUDE.md, condensed.
3. **Personas** — short list with one-line descriptions.
4. **Quickstart** — `run.ps1 install`, `run.ps1 start`, `/new-project`, swap to Explorer, etc.
5. **Commands and tools reference** — auto-generated where possible (the same source `/help` uses).
6. **Project layout** — replace the stale `orchestrator/` tree with the current one.
7. **Roadmap** — link to `ROADMAP.md`.
8. **Non-goals** — explicit, so contributors don't propose Cursor-replacement features.

Don't start the rewrite until tasks 01–13 land. The surface needs to settle first.

## Acceptance

- Status line shows the active persona persistently and the sub-agent count when applicable.
- `/help` lists every registered command, grouped sensibly.
- README reflects the current layout, commands, and tools and links to this roadmap.
