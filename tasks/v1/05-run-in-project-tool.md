> **Status:** ✅ Completed (2026-07-04)

# 05 — `run_in_project` tool (host-dispatched, networked)

**Version:** V1
**Depends on:** V1/02 (registry + dispatch), V1/07 (the scaffold declares the `runner` service this targets), Foundation/04 (sandbox layer / host Docker access).
**Blocks:** V1/10 (the Worker runs `npm i`, tests, builds through this).

## Why

The root sandbox (`ai_sandbox`) is a slim base with only shell — no Node, Python, or any toolchain. The Worker can write tests but can't run them. Per CLAUDE.md, **each project ships its own `docker-compose.yml`** with a language runtime. This tool dispatches language-specific commands into the project's **own container**, host-side. Port old `tasks/10-run-in-project-tool.md` — but **remove the air-gap**: with the pivot, the project runner has **controlled network**, so `npm i`, `pip install`, `cargo fetch` actually work.

## Behavior

### Signature

```ts
run_in_project(command: string, timeout_s: number = 120) -> {
  exit_status: number,
  stdout: string,
  stderr: string,
  duration_ms: number
}
```

Tool description string (read by the model): *"Run a language-specific command (test, build, lint, install — e.g. `npm i`, `npm test`, `pytest`, `cargo build`) inside the project's own networked container. Returns exit_status, stdout, stderr, duration_ms. For plain shell (ls, cat, mv), use execute_command instead."*

### Dispatch (host-side, not from the sandbox)

The **host** invokes Docker for the active project — no docker-in-docker, no socket exposed into `ai_sandbox`:

1. Resolve active project → `projects/<active>/docker-compose.yml` must exist. The compose declares one service named **`runner`** (the V1/07 scaffold convention) with the stack image, `working_dir: /workspace`, a `.:/workspace` volume, **network enabled**, a rootless `user:`, and CPU/RAM caps.
2. Run on the host (via dockerode or `child_process` to the `docker` CLI — keep it simple):
   ```
   docker compose -f projects/<active>/docker-compose.yml run --rm runner <command>
   ```
   `--rm` so the container is disposable per call.
3. Apply `timeout_s`. **On timeout, kill the container** (`docker compose -f ... down` / kill the `runner` container) so nothing leaks, then return a structured timeout result (`exit_status: -1`, `stderr` noting the timeout, real `duration_ms`).
4. Capture stdout and stderr **separately**. Truncate **each** to a sane size for the window (e.g. 50 KB head + tail with a `...truncated...` marker). The full output is not persisted in V1 (audit keeps only a preview — V1/06).
5. Log to the audit (V1/06) with the standard shape; `exit_status` and `duration_ms` come from the run.

### Network posture

- The runner has **controlled internet** (the pivot reverses `network_mode: none`). `npm i` / `pip install` reach their registries. How hard the egress is capped (open vs. allowlist/proxy) is an open question in ROADMAP — V1 ships with whatever Foundation/04 + V1/07 default to; this tool does not implement the cap, it just doesn't disable the network.

### Auto-build + cache

- **Image not built yet** → auto-build on first run: `docker compose -f ... build`, then retry the original command. Subsequent calls skip the build (Docker layer cache). Log **both** the build and the run as audit rows.
- Dependencies installed into `/workspace` (e.g. `node_modules`, a venv in the project) persist because the project tree is the bind-mounted volume; deps installed into image layers persist via the cached image.

### Failure modes (each a distinct structured recoverable error)

- No `docker-compose.yml` in the active project → `{ "error": "No docker-compose.yml in project '<active>'.", "hint": "Scaffold one with /new-project <name> <stack>." }`.
- Docker daemon unreachable → distinct error so the model doesn't retry uselessly: `{ "error": "Docker daemon unreachable." }`.
- Build failure → return the build's stderr in the structured result so the model can read and react.

## Files

- `src/tools/run-in-project.ts` — the `ToolModule`; resolves `projects/<active>/docker-compose.yml`, runs `docker compose run --rm runner`, applies timeout, truncates, auto-builds.
- `src/core/container/project-runner.ts` (optional) — a thin host-side helper wrapping the `docker compose` invocations and the kill-on-timeout, so the tool stays declarative. Distinct from the root-sandbox client (Foundation/04).

## Notes / pitfalls

- **Clearly distinct from `execute_command` (V1/04):** that one runs **plain shell in the shared root sandbox** at `/workspace`; this one runs **language commands in the project's own disposable, networked container**. Both see the same `/workspace` tree (same bind mount), but only this one has a toolchain and network for installs. State the distinction in both tool descriptions and in the Worker phase markdown, or the model conflates them.
- **Kill on timeout, always** — a hung `npm test` or an install that wedges must not leak a container. Acceptance checks this explicitly.
- **Truncate stdout/stderr separately** — a verbose `npm i` can flood the window; keep head+tail.
- **Air-gap is gone** — do **not** carry over `network_mode: none` from the old task. Installs are the whole point of this version.
- **Not for long-running services.** Don't start a dev server with this (it would hang to timeout). A separate tool later if needed.
- **Build + run are two audit rows** on first invocation — don't collapse them.

## Acceptance

- On a `node` project scaffolded via V1/07, the Worker runs `npm i` → it actually installs (proves network), `node_modules/` appears under `projects/<active>/`, audit shows a build row (first time) then the run row with a real `duration_ms`.
- Worker writes a failing test, runs `npm test` → `exit_status` non-zero, `stderr` shows the failure; fixes the code, re-runs → `exit_status: 0`.
- `run_in_project("sleep 999", timeout_s=2)` → returns a timeout structured result within ~2s and **no `runner` container is left running** (`docker ps` is clean).
- `run_in_project` on a project with no `docker-compose.yml` → the structured "scaffold one" error, turn continues.
