> **Status:** ⬜ Not started

# 03 — Status line, `/help`, and discoverability

**Version:** V5
**Depends on:** Foundation/05 (persistent-REPL UI + baseline status line: project · phase · model · tokens · num_ctx), V1/02 (command registry — the `/help` source), V1/06 (tool-audit / tool-dispatch hooks the "current tool" + timers read from), V5/01 (sub-agent count), V5/02 (live model field).
**Blocks:** V5/05 (README's commands reference reuses the same `/help` source).

## Why

The surface is now broad — phases, tools, sub-agents, model switching — and the user drives it all from one persistent REPL. Discoverability and at-a-glance state lag behind. This task makes the **status line** answer "what's happening right now?" without scrolling, adds an auto-generated **`/help`** so the command set documents itself, and surfaces the **Shift+Tab** phase-cycle hint that's wired but invisible. Token values shown anywhere remain **exact** from Ollama (CLAUDE.md rule). Do these once the surface is stable — status lines bloat fast, so add only what's specified.

## Behavior

### Status-line additions

The baseline status line (Foundation/05) already shows project · phase · model · tokens · num_ctx. Add, to the persistent-REPL UI:

- **Active phase, persistent and color-coded.** The active phase is always shown in its theme color on the status line (not only on the input line), so the user always sees which phase will receive their next message even while typing a multi-line input. Each phase has a stable color in the theme (`src/core/ui/theme.ts`).
- **Current tool + elapsed time.** While a tool call is executing, show the tool name and a live elapsed timer, e.g. `running run_in_project (3.2s)`; clear it when the call returns.
- **Time-since-last-tool-call.** When the model is "thinking" (a turn is streaming but no tool has fired for a while), show time since the last tool call so a long stall is visible rather than looking hung.
- **Sub-agent count.** `Subagents: N` when `N > 0` (count from V5/01's `SubagentManager`); the field is **omitted** entirely when zero.

All token figures (the existing prompt/eval/context fields) must come from Ollama's exact `prompt_eval_count` / `eval_count` — never a length-based estimate. If a count is unavailable for a turn, render it as unknown (e.g. `?`) rather than a guess.

Add nothing beyond the above without a concrete moment where it was missed — keep the line scannable.

### `/help`

- A `/help` command that lists every **registered** user command with a one-line description, **auto-generated from the command registry** (the same source V1/02 established), so new commands appear automatically as they land — no hand-maintained list to drift.
- **Grouped by purpose** — e.g. *session* (`/swap`, `/exit`, `/clear`, `/resume`), *models* (`/models …`), *projects* (`/new-project`), *sub-agents* (`/subagents`). Each command carries a `group` + one-line `description` in its registry entry; `/help` reads those. (List exact groupings against whatever commands exist when V5 is built.)

### Shift+Tab discoverability

Shift+Tab / Ctrl+Shift+Tab cycle the active phase (wired in the REPL UI) but nothing tells the user. Add a one-line hint in the **input footer**, e.g. `Shift+Tab: cycle phase · /swap <phase>: jump · /help: commands`.

## Files

- `src/core/ui/status-line.ts` (or the Foundation/05 renderer) — render the new fields: persistent color-coded active phase, current-tool + elapsed timer, time-since-last-tool-call, conditional sub-agent count.
- `src/core/ui/theme.ts` — per-phase color map (stable color per phase) so the active-phase field and `/help`/footer styling are consistent.
- `src/commands/help.ts` *(new)* — the `/help` command; reads the command registry, groups by `group`, prints name + description.
- `src/commands/registry.ts` (or wherever V1/02 defined it) — ensure each command entry carries `name`, `group`, and a one-line `description` so `/help` and the README (V5/05) can both read them.
- `src/core/ui/input-footer.ts` (or the REPL input component) — the Shift+Tab / `/swap` / `/help` hint line.
- Hooks from tool dispatch (V1/06) → the renderer for "current tool started/ended" + "last tool call at" timestamps to drive the elapsed/since timers.

## Notes / pitfalls

- **Tokens exact (CLAUDE.md).** Every token field on the status line is the Ollama exact count; missing → shown as unknown, never estimated.
- **`/help` must not drift.** Generate from the registry, not a static string — a new command with no `/help` entry is the bug this prevents. If a command lacks a `description`/`group`, surface that as a visible gap (e.g. "(no description)") rather than hiding it.
- **Phase terminology only.** Labels, theme keys, and help text say *phase* (Discovery/Design/Breakdown/Worker/Reviewer/Retro) — no "persona"/"role" anywhere in the UI strings or types.
- **Timers are UI-only.** Elapsed/since-last-tool timers are display state; they must not feed any VRAM-safety or summarization decision (that's the exact token count's job).
- **Don't bloat.** Resist adding more status fields. The four additions above are the scope.
- **Persistent scrollback intact.** Status-line updates must not corrupt the streamed scrollback the persistent REPL preserves (re-render the status region in place; don't reflow history).

## Acceptance

Verify by driving a live `run start` session:

- The active phase shows persistently on the status line in its theme color and stays visible while typing a multi-line message; `/swap` (and Shift+Tab) changes it live.
- During a tool call (e.g. `run_in_project`), the status line shows the tool name with a live elapsed timer that clears when the call returns; during a long stream with no tool calls, the time-since-last-tool-call field grows.
- With one or more sub-agents active, `Subagents: N` appears; after dismissing all, the field disappears.
- `/help` lists every registered command grouped by purpose with a one-line description; registering a new command and re-running `/help` shows it automatically (no manual edit).
- The input footer shows the Shift+Tab / `/swap` / `/help` hint; pressing Shift+Tab cycles the phase as advertised.
- Cross-check a turn's token fields against the Ollama response — they match the exact `prompt_eval_count` / `eval_count`.
