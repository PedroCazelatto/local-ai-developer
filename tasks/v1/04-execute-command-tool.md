> **Status:** ⬜ Not started

# 04 — `execute_command` tool

**Version:** V1
**Depends on:** V1/02 (registry + dispatch), Foundation/04 (root sandbox container, networked + hardened, only the active project mounted at `/workspace`).
**Blocks:** the model doing plain shell work (navigation, file ops, piping) during any phase.

## Why

The model needs plain shell — `ls`, `cat`, `mv`, `mkdir`, piping — inside the sandbox. Port old `tasks/03-execute-command-workdir-scoping.md`: the real boundary is **mount isolation**, not string inspection. Foundation/04's root sandbox (`ai_sandbox`) mounts **only the active project** at `/workspace`; other projects and the host are not mounted at all, so they are unreachable no matter how a command is written (`..`, `$(...)`, variables, symlinks). This tool runs at `/workspace` and returns a clean recoverable error on `..`/escape attempts so the model self-corrects — but the *guarantee* comes from the mount, not from parsing the string.

## Behavior

### Signature

```ts
execute_command(command: string) -> string   // combined stdout+stderr, or a structured error
```

Tool description string (read by the model): *"Run a plain shell command (ls, cat, mv, mkdir, piping) in the active project at /workspace inside the sandbox. Paths are relative to the project root. NOT for language toolchains (tests, builds, npm/pip) — use run_in_project for those."*

### Execution

- Run inside the **root sandbox container** (`ai_sandbox`, Foundation/04) via the dockerode exec API, with `workdir: "/workspace"`.
- `/workspace` **is** the active project root (only it is mounted). So `/workspace/foo` is a legitimate in-project path — there is no cross-project regex to apply (old task 03's note: with one project as the root, `/workspace/<x>` is now legitimate).
- Capture combined output (stdout + stderr) and return it as the tool result. Truncate very large output to a sane head+tail for the window (the *audit preview* is truncated separately in V1/06).
- The command runs as the **hardened rootless user** Foundation/04 configured; it inherits the container's CPU/RAM caps and controlled network.

### Self-correction guard (cheap, not security)

- Before dispatching, if the raw `command` string contains an obvious escape attempt (`..` path segments, or absolute paths outside `/workspace`), return a **structured recoverable error** so the model rewrites its command: `{ "error": "Command appears to escape /workspace (found '..'). Use paths relative to the project root.", "hint": "Everything you need is under /workspace." }`. Log the rejection (V1/06) with `exit_status: -1`.
- This is a guardrail against an honest mistake by a confused model — **not** a sandbox. Do not attempt to fully parse the shell; `$(...)`, variables, and interpreters can still construct a `..`, and that's fine: the mount makes it land in the empty container OS, not in another project or on the host (verified-live note from old task 03).

### Result vs. error

- Success: return the captured output string (even on non-zero exit — the model needs to see the error text; the *audit row* records the real exit code).
- Docker/exec failure (daemon unreachable, container not running): structured recoverable error so the model doesn't loop uselessly.

## Files

- `src/tools/execute-command.ts` — the `ToolModule`; calls the Foundation/04 sandbox exec helper with `workdir: "/workspace"`.
- `src/core/container/sandbox.ts` (Foundation/04) — reuse its `exec` helper; this task does not add a new Docker abstraction.

## Notes / pitfalls

- **Mount isolation is the boundary, string-matching is a courtesy.** Do not re-introduce a cross-project regex — with one project mounted as `/workspace`, `/workspace/<x>` is in-project and legitimate (old task 03 explicitly removed that regex).
- **Don't change the signature** — keep `command: string`. Only resolution/workdir behavior is defined here.
- **This is not for toolchains.** `npm i`, `pytest`, `cargo build` need a real runtime; the root sandbox is a slim base with only shell. Those go to `run_in_project` (V1/05). The phase markdown and this tool's description must both say so, or the model will try `npm i` here and get "command not found".
- **Networked sandbox:** the root sandbox now has controlled internet (the pivot), but it still lacks language toolchains — network access here is for shell utilities that need it (e.g. `curl`), not a substitute for the project runner.
- Every call (success, non-zero exit, rejected escape, Docker failure) → exactly one audit row (V1/06), with the real `exit_status` recorded.

## Acceptance

- `run start hello-world`, `/swap worker`, ask "what's in this project?" → an `ls` runs and lists the project's files (not the projects root, not the host).
- Ask it to `mkdir src && echo hi > src/a.txt` → succeeds; the file is visible to `read_file` (V1/03) and on disk under `projects/hello-world/`.
- A model-issued `cd ../other-project && ls` → either the structured escape error (guard caught it) or an `ls` of the empty container OS — **never** another project's files. The audit row shows `workdir: "/workspace"`.
- `npm i` here returns a "not found"-style output (proving toolchains aren't in the root sandbox), nudging the model to `run_in_project`.
