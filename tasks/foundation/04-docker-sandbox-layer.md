> **Status:** ⬜ Not started

# 04 — Docker sandbox layer (dockerode)

**Version:** Foundation
**Depends on:** 02 (config provides `projectName` + `projectPath`)
**Blocks:** 06 (tool dispatch executes commands through this client); all of V1 (file/exec tools run here)

## Why

**Hard rule: the model touches only Docker, never the host filesystem** (CLAUDE.md "Sandboxing & tools"). Every command the model runs and every file it edits happens inside a container; the orchestrator is the only host-side process. This task ports `core/container/client.py` (Docker exec via the Python SDK) to a **dockerode**-based client in TS, and — per the ROADMAP pivot — flips the sandbox from `network_mode: none` to **networked + hardened** so projects can `npm i` / `pip install`. Only the active project is mounted, so the model cannot reach other projects or the host no matter how a command is written (`..`, `$(...)`, symlinks).

## Behavior

A `SandboxClient` class in `src/core/container/`, wrapping the `dockerode` package.

### Lifecycle

```ts
export class SandboxClient {
  constructor(opts: { containerName: string; projectPath: string; /* caps, image */ });

  ensureStarted(): Promise<void>;  // start on session boot; idempotent
  stop(): Promise<void>;           // on `run stop`
  exec(command: string, opts?: { workdir?: string; timeoutMs?: number }): Promise<ExecResult>;
}

export interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}
```

- **`ensureStarted`**: ensure the root sandbox container (`ai_sandbox`) is up. `run.ps1 start` already does `docker compose up -d`, so this is primarily a "get the container handle, start it if stopped" guard — get the container by name, start if not running, create from the configured image if missing. Idempotent.
- **`stop`**: stop the container (matches `run.ps1 stop` → `docker compose stop`). Don't `rm` if we're persistent (see lifecycle decision below).
- **`exec`**: run a shell command **at workdir `/workspace`** (default), capturing `stdout`, `stderr`, and `exitCode` separately. Ports `client.py`'s `exec_run(..., demux=True)`. With dockerode: `container.exec({ Cmd: ['sh','-c', command], WorkingDir: workdir ?? '/workspace', AttachStdout: true, AttachStderr: true })`, then `start()`, demultiplex the stream (use `container.modem.demuxStream` to split stdout/stderr), and read the exit code from `exec.inspect()` after the stream ends.
- **Errors are recoverable, never thrown to kill the turn.** A failed command (non-zero exit, image missing, exec error) returns an `ExecResult` with the captured stderr and a non-zero `exitCode` — it does not throw. (Ports the Python `except` that returned `{exit_code:1, stdout:"", stderr:str(e)}`.) The orchestrator/tool layer turns this into a structured result the model can read and retry from.

### Image

Use **`node:<lts>-slim`** (e.g. `node:22-slim`), **not** `debian:stable-slim`. Justification: V1's project work and `npm i` need `node`/`npm` present, and a Debian slim base would force every project to reinstall a toolchain into an ephemeral layer. `node:slim` already carries `node` + `npm` and is still small; language runtimes a *project* needs (Python, Rust) belong to the project's own per-project container (a separate, later concern), but the **root** sandbox should at least have Node so the common path works without surprises. (Keep the choice documented in the compose file comment.)

### Hardening (networked, but locked down)

- **Networked** — the container has internet so package installs work. This **reverses** the old `network_mode: none`. (How hard to cap egress — open vs. registry allowlist/proxy — is an open ROADMAP question; default to open egress for Foundation and note it.)
- **Rootless user** — run as a non-root user (the `node` image ships a `node` user; set `User: 'node'` / compose `user: node`). The model must not run as root inside the box.
- **CPU + RAM caps** — port the old `cpus: '2.0'` / `memory: 4gb`. With dockerode use `HostConfig.NanoCpus` (e.g. `2_000_000_000` for 2 CPUs) and `HostConfig.Memory` (bytes, e.g. `4 * 1024**3`). In compose, keep the `deploy.resources.limits` block.
- **Only the active project mounted** — bind-mount `projectPath:/workspace` and **nothing else**. No host root, no `./projects` (which would re-expose every project). Fail closed if `projectPath` is unset/missing (don't fall back to mounting the projects root).
- **`WorkingDir: /workspace`** — `/workspace` IS the project root; `exec` runs there by default.

### docker-compose.yml update

Rewrite the existing root `docker-compose.yml` to reflect networked + hardened:

- **Remove** `network_mode: none`.
- Change `image:` to the `node:<lts>-slim` choice.
- Add `user: node` (rootless).
- Keep `container_name: ai_sandbox`, `working_dir: /workspace`, the `deploy.resources.limits` caps, `stdin_open`/`tty`, and a long-lived `command` (e.g. `sleep infinity` or `tail -f /dev/null` — a `node` image has no interactive `bash` by default, so don't rely on `/bin/bash`).
- Keep the **mount of only the active project**: `./projects/${ACTIVE_PROJECT:-__no_project__}:/workspace`, fail-closed sentinel preserved exactly as the current file does.

## Files

- `src/core/container/sandbox.ts` — `SandboxClient` (dockerode): `ensureStarted`, `stop`, `exec`, `ExecResult`.
- `src/core/container/index.ts` — re-export.
- `docker-compose.yml` — **rewrite**: drop `network_mode: none`, switch to `node:<lts>-slim`, add `user: node`, keep caps + single-project mount + fail-closed sentinel, long-lived non-bash `command`.

## Notes / pitfalls

- **The mount boundary is the whole security model.** Mount only `projectPath` at `/workspace`. Never mount the host root or `./projects`. `..` / `$(...)` / symlinks inside a command cannot escape a container that simply never had the host mounted. Do not "helpfully" add more mounts.
- **Demux correctly.** dockerode multiplexes stdout+stderr on one stream unless you attach a TTY; use `modem.demuxStream(stream, stdoutSink, stderrSink)` so stdout and stderr stay separate (the Python `demux=True` equivalent). Don't concatenate them.
- **Exit code comes from `inspect`, not the stream.** Await the stream end, then `await exec.inspect()` and read `.ExitCode`.
- **Recoverable, not thrown.** Container-not-found, image-pull failure, exec error → return an `ExecResult` with a clear `stderr` and non-zero code. Throwing here would kill the model's turn; the rule is structured, recoverable errors.
- **Lifecycle: persistent vs ephemeral (open question).** Recommend a **persistent** root container so installed deps (`node_modules`, pip caches) survive across commands within a session — re-`--rm`-ing per command would reinstall on every call. `ensureStarted` reuses the running container; `stop` stops (does not remove) it. Note this is the recommended resolution of the ROADMAP open question, not a hard rule — leave a comment so it's revisitable.
- Ollama itself runs on the **host GPU**, not in Docker. This client is for the model's *actions*, never for hosting the model.

## Acceptance

- After `.\run.ps1 start hello-world`, `SandboxClient.ensureStarted()` finds the running `ai_sandbox` container (started by `docker compose up -d`).
- A scripted live check calls `exec('echo hi && pwd')` and gets `{ exitCode: 0, stdout: "hi\n/workspace\n", stderr: "" }` — confirming workdir is `/workspace` and stdout/stderr are demuxed.
- `exec('node --version')` returns a real version (Node present in the image) with exit 0.
- `exec('cat /etc/shadow')` or `exec('ls /')` shows the model is **not** root (rootless user) and cannot see host files — only the mounted project tree under `/workspace`.
- `exec('curl -sI https://registry.npmjs.org')` (or `npm ping`) succeeds — the sandbox **is** networked (the pivot reversal verified).
- `exec('false')` returns `exitCode: 1` **without throwing**; a command against a stopped/missing container returns a non-zero `ExecResult` with the error in `stderr`, not an exception.
- `docker inspect ai_sandbox` shows the memory + CPU caps applied and only `projects/hello-world` bind-mounted at `/workspace`.
