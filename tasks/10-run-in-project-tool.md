# 10 — `run_in_project` tool (host-dispatched)

**Milestone:** M5 — Real runtimes
**Depends on:** 01 (tools reachable), 03 (project workdir scoping in execute_command — keeps the two tools coherent).

## Why

The root `ai_sandbox` is `debian:stable-slim` with no Python, Node, Rust, or any language toolchain. The Developer persona can write tests but can't run them. Per CLAUDE.md, each project ships its own `docker-compose.yml` with its own runtime container. The orchestrator just needs a way to dispatch into it.

Direction chosen for the roadmap: **host-dispatched `run_in_project` tool**. The host (not the sandbox) invokes `docker compose` for the active project. No docker-in-docker, no docker socket exposure into `ai_sandbox`.

## Files

- New `tools/run_in_project.py`
- `core/container/client.py` — may need a sibling helper that talks to host Docker rather than the sandbox container. Or call `subprocess.run(["docker", ...])` directly from the tool — simpler, fewer abstractions for now.

## Tool signature

```python
run_in_project(command: str, timeout_s: int = 120) -> {
  "exit_status": int, "stdout": str, "stderr": str, "duration_ms": int
}
```

## Behavior

1. Resolve active project → `projects/<active>/docker-compose.yml` must exist.
2. Run on the host:
   ```
   docker compose -f projects/<active>/docker-compose.yml run --rm runner <command>
   ```
   Convention: the project's compose declares one service named `runner` that the orchestrator targets. Document this in the project scaffold (task 11).
3. Apply `timeout_s` via `subprocess.run(..., timeout=)`. On timeout, kill the container (`docker compose down` for that service) so we don't leak.
4. Capture stdout/stderr separately. Truncate each to a sane size for the model (e.g., 50KB head + tail).
5. Log to `tool_audit.jsonl` (task 02) with the same shape as other tools.

## What this tool is NOT for

- Plain shell ops (`ls`, `cat`, `mv`) — those stay in `execute_command` and stay inside `ai_sandbox`.
- Long-running services. Don't try to start a dev server with this. A different tool for that, if/when needed.

The model's persona prompt should explain the distinction. The tool description string itself should say it clearly: *"Run a language-specific command (test, build, lint) inside the project's own container. For plain shell, use `execute_command`."*

## Failure modes

- No `docker-compose.yml` in the active project → return a structured error directing the user/model to scaffold one (task 11).
- Docker daemon unreachable → distinct structured error so the model doesn't retry uselessly.
- Image not built yet → auto-build on first run with `docker compose -f ... build`, then retry the original command. Subsequent calls skip the build. Log both the build and the run in `tool_audit.jsonl`.

## Acceptance

- Developer persona, on a project scaffolded with task 11, runs `pytest -q`, sees the failures, edits a file, re-runs, sees them pass.
- `tool_audit.jsonl` records the invocations with correct durations and exit codes.
- Killing the orchestrator mid-`pytest` does not leave a dangling container.
