> **Status:** ✅ Completed (2026-06-12)

# 01 — Wire tools to agents

**Milestone:** M1 — Tools online
**Blocks:** every other task that depends on the model being able to act.

## Why

`agents/factory.py:21` always sets `tools=[]` on every `Agent`, so the model never receives any tool definitions. `orchestrator._allowed_tools()` already filters `ToolFactory.definitions` against `agent.tools` — it just always filters down to nothing. Until this is fixed, every other milestone is theoretical.

## Behavior

Every persona gets the **full** set of `ToolFactory.definitions`. No per-persona whitelist. Each persona's markdown is where the model is told *which* tools to use for that role — the orchestrator does not gate access.

This keeps the wiring trivial and lets persona prompts evolve without code changes. If a persona starts misusing a tool, the fix is in its markdown, not in a registry.

## Files

- `agents/factory.py` — replace `tools=[]` with the full `ToolFactory.definitions` (or pass the factory in and let `Agent` resolve it lazily).
- `agents/base.py` — already has the `tools` attribute; no API change.
- `core/session/orchestrator.py` — `_allowed_tools()` becomes a passthrough. Either delete it or have it return all definitions; pick whichever is cleaner.

## Note on later tools

When tasks 04 (inbox), 06 (search/load rule), 10 (run_in_project), and 12 (sub-agents) land, those tools are picked up automatically by `ToolFactory` from `tools/*.py`. No code change needed here to accommodate them.

## Acceptance

- Running `main.py`, swapping to **Developer**, and asking it to read `README.md` results in a real `read_file` tool call (visible as `→ tool: read_file`).
- Swapping to any other persona and asking it to read a file works the same way — no persona is artificially blocked from any tool.
- `orchestrator.call_tool(name, args)` routes correctly for every registered tool.
