# 13 — Model picker UI (`/models list|pull|use`)

**Milestone:** M7 — Polish

## Why

`README.md` advertises `/models list` and `/models pull`. `main.py:12` hardcodes `qwen2.5-coder:14b`. Two problems: the README lies, and switching models requires editing code. CLAUDE.md notes the eventual move to UI control — this task is the move.

## Files

- New `tools/models.py` — `BaseCommand` subclass dispatching the subcommands.
- `core/llm/provider.py` — accept a model name parameter; remove the hardcode in `main.py`.
- `core/session/orchestrator.py` — surface the active model so the status line shows it (already does, via the provider).
- A small state file at `~/.local-ai-developer/state.json` to remember the last-used model across restarts.

## Subcommands

- **`/models list`** — call `ollama list` and print a table: name, size, last modified. Highlight the active model.
- **`/models pull <name>`** — call `ollama pull <name>`, stream progress to the UI. Block until done; the user shouldn't try to use the model before the pull finishes.
- **`/models use <name>`** — set the active model for the current session. If the model isn't pulled, fail with a hint to `/models pull` first.

## Persistence

`/models use` is session-local in effect, but the choice is persisted to `~/.local-ai-developer/state.json` so the next `.\run.ps1 start <project>` defaults to it. The user can always override at runtime.

## UI

- Status line shows the active model name (it does today; verify it updates after `/models use`).
- During `/models pull`, render a progress line (Ollama streams a percentage).
- Cancel: support Ctrl-C to abort a pull cleanly.

## Acceptance

- `/models list` shows the locally available models, with the active one marked.
- `/models pull llama3.1:8b` streams progress and, on completion, leaves the model usable.
- `/models use llama3.1:8b` swaps the model immediately; the next `/swap developer` turn uses it.
- Restart `main.py` — the previously-selected model is the default.
