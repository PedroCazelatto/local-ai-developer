# Sandboxing & tools

Two-tier Docker model. **Hard rule: the model touches only Docker, never the host filesystem.** Every
command it runs and every file it edits happens inside a container; the orchestrator is the only
host-side process. **Containers have controlled internet** (so projects can `npm i`, `pip install`,
etc.) — hardened per the dockerode model: rootless user, CPU/RAM caps, disposable lifecycle.

- **Root sandbox** ([docker-compose.yml](../docker-compose.yml)) — one long-lived container named
  `ai_sandbox`. It mounts **only the active project** at `/workspace`
  (`./projects/${ACTIVE_PROJECT}:/workspace`, where `scripts/run.mjs` sets `ACTIVE_PROJECT` from the
  session's project arg). Other projects and the host filesystem are **not mounted at all**, so the
  model cannot reach them no matter how a command is written (`..`, `$(...)`, variables, symlinks).
  `/workspace` IS the project root; `execute_command` runs there. It runs **plain shell commands**
  (file operations, navigation, piping) without giving the model host access.
- **Per-project sandbox** — each project folder carries its own `docker-compose.yml` declaring a
  `runner` service with the language toolchain (Python, Node, Rust, …) and network access. The
  execution loop's **test/build/install steps** run against this container through the
  **host-dispatched `run_in_project` tool**; there is no docker socket inside `ai_sandbox`. It runs in
  Docker, never on the host.

## Tool ground rules

- The local Ollama model runs on GPU/VRAM on the **host** — Docker is CPU-focused and cannot host it.
- Tools run **autonomously**, **every call is logged**, and the tool set grows **on demand** — see
  [constitution.md](../constitution.md).
- Tools live under [src/tools/](../src/tools/) — one model-callable tool per file.
