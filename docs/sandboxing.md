# Sandboxing & tools

Two-tier Docker model. **Hard rule: the model touches only Docker, never the host filesystem.** Every
command it runs and every file it edits happens inside a container; the orchestrator is the only
host-side process. **Containers have controlled internet** (so projects can `npm i`, `pip install`,
etc.) — hardened per the dockerode model: rootless user, CPU/RAM caps, disposable lifecycle.

## How the file tools honour that rule

The rule above was a claim before it was a fact. `read_file`, `write_file`, `edit_file`,
`list_files` and `search_in_files` used to run **host-side**, scoped only by a *lexical* prefix check
(`resolveInProject`) that never resolved symlinks — while Node's `readFileSync`/`writeFileSync`
follow them. A link planted from inside the sandbox (`ln -s / esc`, which `execute_command`'s `..`
guard does not catch) therefore read and wrote straight through the boundary. They now run in the
container:

- **Bytes** — `read_file` / `write_file` / `edit_file` move file content over Docker's archive
  endpoints as a tar stream. Never a shell command: content would otherwise have to survive `sh -c`
  quoting, and a tar stream has no quoting rules to get wrong and no argv length ceiling. Parent
  directories travel as directory members of the same archive, which is how `write_file` still
  scaffolds `src/foo/bar.ts` into an empty project.
- **Walks** — `list_files` (`find`) and `search_in_files` (`grep -rl`) run as commands in the
  container. Neither follows a symlink it meets, so nothing they return was reached through one.
- **Scoping runs on BOTH sides.** Host-side `resolveInProject` now resolves the real path (down to the
  deepest existing ancestor, so a file that does not exist yet still validates) and rejects `..` and
  absolute escapes. Container-side `realpath -m` then re-checks that the path really lands under
  `/workspace`. The second check is not redundant: on Windows + Docker Desktop a link created inside
  the sandbox does **not** materialize on the NTFS side, so the host check cannot see it — a live test
  confirmed `read_file('esc/etc/hostname')` returning the container's hostname until the
  container-side check was added. A security check must run on the same side as the I/O it guards.

**The git tools are the exception, and they are host-side on purpose.** `commit_changes`,
`list_changes`, `git_inspect`, `git_stash`, `git_branch` and `git_push` run against the project repo
on the host, because the root sandbox ships no git. They never open project files for content — they
hand paths to git — and each validates those paths through the same `resolveInProject`.

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

## Look before you write

Scoping decides *where* a tool may write. This decides *whether* it may. `edit_file` and `write_file`
refuse to change a file that **already exists** until the window asking has read it, and refuse again if
the file changed after that read. Creating a new file is never gated — there is nothing to have read,
and gating it would break scaffolding into an empty project.

- **The window is the unit.** Each runner that owns a `callTool` owns one tracker
  ([read-tracker.ts](../src/core/session/read-tracker.ts)): the orchestrator holds one per master
  phase, and the Worker, Reviewer, Retro and every sub-agent hold their own. So a **sub-agent's reads
  never satisfy its master's guard** — the master never saw what the sub-agent read, and a brief
  summarising a file is not the file.
- **The tracker follows the phase context, not the process.** `/clear` and `/resume` empty the active
  phase's tracker: those reads live in the context being set aside, and the model can no longer see
  them. `/swap` does not — it changes which phase is active, not which context that phase is on. The
  Worker's tracker deliberately survives all five review rounds.
- **Staleness is a content hash, not an mtime.** Both write tools already hold the file's bytes at the
  moment they need the answer — `edit_file` reads before it splices, `write_file` reads to tell a create
  from an overwrite — so comparing content costs **no extra container round-trip**, while a `stat`
  would cost one. It is also exact: a git checkout that rewrites a file to identical bytes moves the
  mtime and changes nothing the model read.
- **The two refusals carry different instructions.** "You have not read it" and "it has changed since you
  read it" are different mistakes with different fixes, and a model handed the wrong one loops.
- **What it buys back.** Because the harness knows what a window has seen, the phase prompts can tell the
  model *not* to re-read a file to verify its own edit — a successful result means the edit landed. That
  verification read was correct behavior while nothing tracked file state, and it is one of the duplicate
  reads [evict-stale-tool-results.md](../backlog/evict-stale-tool-results.md) exists to clean up after.

## Tool ground rules

- The local Ollama model runs on GPU/VRAM on the **host** — Docker is CPU-focused and cannot host it.
- Tools run **autonomously**, **every call is logged**, and the tool set grows **on demand** — see
  [constitution.md](../constitution.md).
- Tools live under [src/tools/](../src/tools/) — one model-callable tool per file.
- **Every call is recorded twice, from one place.** `recordToolCall`
  ([src/core/session/record-tool-call.ts](../src/core/session/record-tool-call.ts)) writes the durable
  `tool_audit.jsonl` row and prints the call's `←` line in the scrollback (docs/product.md), and every
  audit-writing site goes through it. That includes the three **runner-level refusals** — the Worker
  refusing `commit_changes`/`git_stash`/`git_push`, the Reviewer refusing every write tool, Retro
  refusing a second file — which answer inside their own window and never reach the dispatcher. They
  are the calls the record matters most for, so the hook is the audit row rather than the dispatcher's
  `onToolCall` seam, which would miss all three.
- **A tool says what its result line should read**, on an optional `display` field of its result. Only
  the tool can: the write tools alone hold a file's bytes either side of a change, and only
  `search_in_files` knows which cap it stopped counting at. That field is **never written to the audit
  log** — `appendAuditRow` builds its row from an explicit field list — so `tool_audit.jsonl`'s format
  is unchanged and a diff body never enters it. A tool that sets nothing still gets a result line, from
  its own error message or a plain `ok`.
