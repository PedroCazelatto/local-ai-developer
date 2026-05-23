# 03 — Scope `execute_command` to the active project

**Milestone:** M1 — Tools online
**Listed as an open question in CLAUDE.md** ("Scoping `execute_command` to the active project's workdir inside the sandbox").

## Why

Today `execute_command` runs from `/workspace` inside `ai_sandbox`. A persona working on project A can `cd ../project-b` and trample anything there. The model isn't malicious, but its judgment about "which project am I in" is unreliable and the blast radius is wide.

## Files

- `tools/execute_command.py` — the tool itself.
- `core/container/client.py` — where `exec_run` is called.
- Whatever holds the "active project" state today (look for where `main.py` derives the project name from the CLI arg and stash it on the orchestrator if it isn't already).

## Behavior

- Resolve every command relative to `/workspace/<active-project>` by passing `workdir=` to `container.exec_run`.
- Reject commands that *attempt* to escape via absolute paths or `..` sequences. Cheap version: reject if the command string contains `/workspace/` of a different project, or absolute `..` traversal — log the rejection and return an error to the model rather than killing the session.
- Update the tool's description string (read by the model) to make the scoping explicit: *"Runs in the active project's directory. Paths are relative to the project root."*

## Things to avoid

- Don't try to fully sandbox shell — `cd ..; rm -rf /` style commands are still possible. The goal is reducing the chance of an honest mistake by a confused model, not building a real sandbox. The real sandbox is the Docker container.
- Don't change `execute_command`'s tool *signature*. Keep `command: str` — only the resolution behavior changes.

## Acceptance

- Asking the Developer persona "What's in this project?" produces `ls` listing files from the active project, not the projects root.
- A model-generated `cd ../other-project` returns a structured error to the model (so it can recover) instead of silently succeeding.
- Test: start a session for `hello-world`, run a command, verify (via `tool_audit.jsonl`) that the workdir on the recorded call is `/workspace/hello-world`.
