> **Status:** ⬜ Not started

# 02 — Model picker UI (`/models list | pull | use`)

**Version:** V5
**Depends on:** Foundation/02 (config + `DEFAULT_MODEL` constant), Foundation/03 (Ollama client), Foundation/05 (persistent-REPL UI + status line), V1/02 (command registry the new subcommands hang off).
**Blocks:** V5/05 (README documents the model commands once they exist).

## Why

The model name is currently a **hardcoded constant** (`DEFAULT_MODEL = 'qwen2.5-coder:14b'` in `src/core/session/config.ts`, ported from `main.py`). Two problems: switching models means editing source, and CLAUDE.md/ROADMAP note the eventual move to UI control. This task makes the model name a runtime choice — listed, pulled, and switched from the REPL — and persists the choice across restarts so the next `run start` defaults to it. The Ollama client must take the model as a **parameter**, not read a constant.

## Behavior

One `/models` command with three subcommands, dispatched from the command registry:

- **`/models list`** — query the local Ollama daemon for installed models and print a table: `name`, `size`, `last modified`. The **active** model (the one this session will send turns to) is clearly marked (e.g. a `*` / arrow + the active theme color).
- **`/models pull <name>`** — pull a model from the registry, **streaming progress** to the UI (Ollama emits a stream of status + completed/total bytes; render a live progress line via `ora`/`@clack/prompts`). **Blocks to completion** — the user must not be able to `/models use` it before the pull finishes. **Ctrl-C aborts cleanly**: cancel the in-flight pull request, leave no half-state in the session, return the REPL to a usable prompt (a partially-pulled blob is Ollama's to garbage-collect; do not crash the orchestrator).
- **`/models use <name>`** — switch the **active model for this session** immediately; the next phase turn (and any newly spawned sub-agent / Reviewer / Worker window) uses it. If `<name>` is **not pulled**, fail with a structured, recoverable message hinting `/models pull <name>` first — do not silently send an unknown model to Ollama.

### De-hardcoding the model

- The Ollama client (`src/core/llm/provider.ts`) takes the model name as a **parameter** on each `chat`/`stream` call (or holds it as mutable session state set by the orchestrator) — never reads a module-level constant.
- `DEFAULT_MODEL` stays only as the **fallback default** used by config when neither persisted state nor a runtime `/models use` has set anything. Resolution order at boot: **persisted state.json → `DEFAULT_MODEL`**.
- `/models use` updates the live session model and the orchestrator propagates it to the status line (which already renders the model field — verify it updates).

### Persistence

`/models use` is session-local in effect, but the chosen name is **persisted** to a small host-side state file so the next `run start <project>` defaults to it. This is orchestrator-global state, **not** per-project (the model is the user's hardware choice, agnostic to which project is open) — so it lives in the user's home dir, not under `projects/<name>/.orchestrator/`:

```
~/.local-ai-developer/state.json     →  { "activeModel": "<name>", ... }
```

Use Node's `os.homedir()` to resolve `~`. Read it at boot (after `DEFAULT_MODEL`, before any turn); write it on every successful `/models use`. A missing/corrupt file falls back to `DEFAULT_MODEL` with a surfaced warning — never crash boot over it.

## Files

- `src/commands/models.ts` *(new)* — the `/models` command + `list` / `pull` / `use` subcommand dispatch; registered in the command registry so `/help` (V5/03) auto-lists it.
- `src/core/llm/provider.ts` — accept the model as a parameter / mutable session field; drop any hardcoded model reference.
- `src/core/llm/ollama-models.ts` *(new, or extend the provider)* — thin wrappers over the Ollama JS client: `listModels()`, `pullModel(name, onProgress, signal)` (streamed, abortable), `hasModel(name)`.
- `src/core/session/config.ts` — keep `DEFAULT_MODEL` as the fallback; `loadConfig` reads `state.json` first and uses it as `modelName` when present.
- `src/core/session/app-state.ts` *(new)* — `loadAppState()` / `saveAppState(partial)` over `~/.local-ai-developer/state.json`; typed shape (no `any`), tolerant of a missing/corrupt file.
- `src/core/session/orchestrator.ts` — holds the active model, applies `/models use`, propagates the change to the provider + status line.
- `src/core/ui/` (status line renderer) — confirm the model field reflects `use` live.

## Notes / pitfalls

- **No `MODEL_NAME` in `.env`.** Per CLAUDE.md "Environment", model selection moves to the **UI**, not env. The source of truth at runtime is the orchestrator's live session model; persistence is `state.json`, not `.env`.
- **Block before use.** A pull must fully finish before the model is selectable; guard `/models use` against a name that isn't actually present locally (`hasModel`) even if a pull was started.
- **Ctrl-C during pull** cancels only the pull (via an `AbortSignal` to the streamed request) and returns to the prompt — it must **not** tear down the whole REPL session.
- **Tokens are exact (unchanged).** Switching models does not change the token rule: counts still come from `prompt_eval_count`/`eval_count` on each turn for whatever model is active.
- **Sub-agents (V5/01) keep their spawn-time model.** `/models use` changes the model for *new* turns/windows; a live sub-agent mid-conversation stays on the model it was created with.
- **Host-side, not in the sandbox.** Ollama runs on the host GPU (CLAUDE.md "Sandboxing"); `list`/`pull`/`use` talk to the host Ollama daemon directly — these are not sandboxed tool calls and don't go through Docker.
- **State scope:** `state.json` is global (home dir), not per-project — a project repo must never carry the model choice.

## Acceptance

Verify by driving a live `run start` session:

- `/models list` shows the locally installed models with name/size/last-modified and clearly marks the currently active one.
- `/models pull <small-model>` streams a live progress line and, on completion, the model shows up in `/models list`; the prompt is blocked (no turn accepted) until the pull finishes.
- Pressing Ctrl-C mid-pull aborts cleanly and returns to a usable REPL prompt without crashing the session.
- `/models use <pulled-model>` switches immediately: the status line model field updates, and the next phase turn (and a freshly spawned sub-agent) runs against the new model.
- `/models use <not-pulled-model>` fails with a recoverable message hinting to `/models pull` first — no Ollama call against the missing model.
- Exit and re-run `run start <project>`: the previously `use`d model is the default (read from `~/.local-ai-developer/state.json`); deleting/corrupting that file falls back to `DEFAULT_MODEL` with a surfaced warning, not a crash.
- Grep the source: no remaining hardcoded model name outside `DEFAULT_MODEL` (the fallback) — the provider takes the model as a parameter.
