> **Status:** ✅ Completed (2026-06-30)

# 02 — Config and session bootstrap

**Version:** Foundation
**Depends on:** 01 (repo skeleton + toolchain)
**Blocks:** 03, 04, 05, 06 (every component needs the resolved config + locked project)

## Why

A session is **locked to exactly one project** for its entire lifetime — switching projects means restarting the process (CLAUDE.md "How a session works"). Before any model call, Docker container, or REPL exists, `src/index.ts` must parse the required `<project-name>` argument, load `.env`, derive `ACTIVE_PROJECT`, and fail clearly if the project folder is missing. This ports `main.py`'s `main()` (argv check, `OLLAMA_NUM_CTX` read, model-name + num_ctx constants) into the TS entry point and centralizes the config object every later component receives.

## Behavior

`src/index.ts` is the entry point. On boot it:

1. Loads `.env` via `dotenv` (`import 'dotenv/config'` or `config()` at the top, before reading `process.env`).
2. Reads the CLI arg: `process.argv[2]` is the **required** `<project-name>`. If absent, print `Usage: run start <project-name>` (matching the user-facing `run.ps1` verb, not `node ...`) and exit non-zero.
3. Resolves config (see shape below) and validates the project exists.
4. **Fails clearly** if `projects/<name>/` does not exist: print e.g. `Error: project 'foo' not found at projects/foo/. Create it first.` and exit non-zero. (No auto-create here — scaffolding is V1's `/new-project`.)
5. Hands the resolved config to the orchestrator + UI (wired in 05/06). For now, printing the resolved config and exiting cleanly is acceptable.

### Config object shape

Define one config type and a `loadConfig(projectName: string): SessionConfig` (or `resolveConfig`) builder in `src/core/session/`. Concrete types only — no `any`.

```ts
export interface SessionConfig {
  projectName: string;     // the locked <project-name> from argv
  projectPath: string;     // absolute path to projects/<name>
  modelName: string;       // DEFAULT_MODEL constant for now (picker is V5)
  numCtx: number;          // from OLLAMA_NUM_CTX, else DEFAULT_NUM_CTX
  initialPhase: string;    // "discovery" (ported from initial_role default)
}
```

Constants (ported from `main.py`):

```ts
export const DEFAULT_MODEL = 'qwen2.5-coder:14b'; // hardcoded for now; UI picker is V5
export const DEFAULT_NUM_CTX = 16384;
export const DEFAULT_PHASE = 'discovery';
```

- `numCtx`: `Number(process.env.OLLAMA_NUM_CTX) || DEFAULT_NUM_CTX` — but guard against `NaN`/`<= 0` and fall back to the default with a surfaced warning rather than silently passing garbage to Ollama.
- `projectPath`: absolute, resolved from the repo root, e.g. `path.resolve(process.cwd(), 'projects', projectName)`. This same absolute path is what task 04 bind-mounts as `/workspace`.
- `ACTIVE_PROJECT`: `run.ps1 start` already sets `$env:ACTIVE_PROJECT` for `docker compose`. The TS process also receives `projectName` via argv; treat argv as the source of truth and assert it matches `process.env.ACTIVE_PROJECT` if present (warn on mismatch — a stale env var must not silently point the sandbox at a different project than the session).

## Files

- `src/index.ts` — argv parse, `dotenv` load, usage/error exits, then construct config and pass it on (boot orchestrator+UI once 05/06 exist).
- `src/core/session/config.ts` — `SessionConfig` interface, the `DEFAULT_*` constants, and `loadConfig(projectName)` with the project-exists check.
- `.env.example` — leave the existing `OLLAMA_NUM_CTX` entry; this task only **reads** it. (Do not add `MODEL_NAME` to `.env` — model name stays a constant until the V5 UI picker, per CLAUDE.md "Environment".)

## Notes / pitfalls

- **One project per session, period.** Nothing in the codebase may switch the active project at runtime — that is a process restart. `projectName`/`projectPath` are read-only on the config after `loadConfig`.
- Load `.env` **before** reading any `process.env.*` value, or `OLLAMA_NUM_CTX` will be `undefined` on first read.
- Fail **loud and early**: a missing project or unreadable `.env` should exit with a clear message, never proceed to start a container against a non-existent path.
- Do not estimate or invent `numCtx`; if the env value is malformed, fall back to `DEFAULT_NUM_CTX` and say so. (`num_ctx` is a hard VRAM ceiling — see CLAUDE.md memory model.)
- Keep model name as a constant here; resist adding a UI/env model selector (that's V5, and adding it now creates a config path the picker will have to undo).

## Acceptance

- `.\run.ps1 start hello-world` (with `projects/hello-world/` present) boots without a config error and the resolved config (project, model, numCtx, phase) is available to the rest of the app.
- `.\run.ps1 start does-not-exist` prints a clear `project ... not found` message and exits non-zero — no container is started, no model is called.
- Running with no project arg prints the `Usage: run start <project-name>` line and exits non-zero.
- Setting `OLLAMA_NUM_CTX=8192` in `.env` is reflected in `config.numCtx`; deleting it falls back to `16384`; setting it to garbage (`OLLAMA_NUM_CTX=abc`) falls back to `16384` with a surfaced warning.
- `config.projectPath` is an absolute path pointing at `projects/hello-world` and equals the path task 04 will mount as `/workspace`.
