> **Status:** ✅ Completed (2026-07-04)

# 03 — Core file tools

**Version:** V1
**Depends on:** V1/02 (tool registry + dispatch + `ToolContext`).
**Blocks:** V1/08 (planning phases write `PRODUCT_SPEC.md`/backlog), V1/10 (Worker writes code/tests).

## Why

The model needs to read and write the project. Port the five file tools from the reference Python (`tools/read_file.py`, `write_file.py`, `list_files.py`, `edit_file.py`, `search_in_files.py`) to TypeScript `ToolModule`s, preserving their behavior and error strings. All operate on the **active project workspace** — the same tree mounted into the sandbox at `/workspace` — strictly path-scoped via `ToolContext.resolve`.

## Behavior

### Boundary nuance

These tools operate on the active project's files **host-side** (the orchestrator owns the host; the model never does). The project tree is *also* mounted into the sandbox at `/workspace`, so a file the model writes here is visible to `execute_command` (V1/04) and `run_in_project` (V1/05). The boundary that matters is **path scoping**: every path is resolved under the active project root and any escape is rejected. The model cannot reach other projects or the host filesystem through these tools.

### `ToolContext.resolve(relative)`

Port the Python `ToolContext.resolve` exactly (`tools/base.py`):

- `root = absolute(projectPath)`; `resolved = absolute(join(root, relative))`.
- If `resolved !== root` **and** `resolved` does not start with `root + sep` → throw/return the scoped error: `Path '<relative>' escapes the project directory`.
- Tools catch this and return it as a **structured recoverable error** (`{ "error": "Path '<relative>' escapes the project directory" }`) so the model self-corrects — they do not crash the turn. (The Python returned a `Error: ...` string; in TS emit the structured shape from V1/02, keeping the same human-readable text.)
- This rejects `..` traversal, absolute paths that land outside root, etc.

### The five tools

Port signatures, parameter schemas, and **error strings verbatim** (text after `Error: ` preserved; wrap in the structured shape):

**`list_files`** — params: none. Lists entries of the project root. If the root doesn't exist, create it, then list. Returns newline-joined names, or `The project is empty.` when empty. On OS error: `Error listing files: <e>`.

**`read_file`** — params: `{ path: string (required) }`, "Path relative to the project root." Reads UTF-8 and returns contents. Errors:
- non-string path → `Error: 'path' must be a string.`
- escape → resolve error (above)
- missing → `Error: File '<path>' not found.`
- invalid UTF-8 → `Error: File '<path>' is not valid UTF-8 text.`
- other OS error → `Error reading '<path>': <e>`

**`write_file`** — params: `{ path: string, content: string }` (both required). **Creates parent directories automatically** (port `os.makedirs(dirname, exist_ok=True)`). Overwrites. Returns `Wrote <N> characters to '<path>'.` where `N` is `content.length`. Errors:
- non-string path → `Error: 'path' must be a string.`
- non-string content → `Error: 'content' must be a string.`
- escape → resolve error
- other OS error → `Error writing '<path>': <e>`

**`edit_file`** — params: `{ path: string, old_string: string, new_string: string }` (all required). Replaces `old_string` **exactly once**; no change if it is missing or matches more than once. Errors (verbatim):
- non-string path → `Error: 'path' must be a string.`
- non-string old/new → `Error: 'old_string' and 'new_string' must be strings.`
- identical → `Error: 'old_string' and 'new_string' are identical — nothing to do.`
- escape → resolve error
- missing file → `Error: File '<path>' not found.`
- invalid UTF-8 → `Error: File '<path>' is not valid UTF-8 text.`
- read OS error → `Error reading '<path>': <e>`
- zero matches → `Error: 'old_string' not found in '<path>'.`
- multiple matches → `Error: 'old_string' matches <N> times in '<path>'. Provide more surrounding context to make it unique.`
- write OS error → `Error writing '<path>': <e>`
- success → `Edited '<path>'.`

**`search_in_files`** — params: `{ pattern: string (required), glob?: string }`. Literal, **case-sensitive** substring search over UTF-8 files under the project root. Skip dirs: `.git`, `__pycache__`, `node_modules`, `.venv`, `venv`, `dist`, `build` (keep this set; TS projects mostly hit `node_modules`/`dist`/`build`). Optional filename glob filter (e.g. `*.ts`). Output lines `<relative>:<lineno>: <line trimmed-right>`, paths with forward slashes. Cap at `200` matches, then append `... truncated at 200 matches.` and stop. Errors:
- empty/non-string pattern → `Error: 'pattern' must be a non-empty string.`
- non-string glob → `Error: 'glob' must be a string if provided.`
- escape (resolving `.`) → resolve error
- no matches → `No matches for '<pattern>'.`
- unreadable/binary files are skipped silently (the Python caught `UnicodeDecodeError`/`OSError` and continued).

## Files

- `src/tools/list-files.ts`, `read-file.ts`, `write-file.ts`, `edit-file.ts`, `search-in-files.ts` — one `ToolModule` each, registered in `src/tools/registry.ts` (V1/02).
- `src/tools/types.ts` — `ToolContext.resolve` lives here (or `src/tools/context.ts`); ported from `tools/base.py`.

## Notes / pitfalls

- **Path scoping is the security boundary for these tools** — get `resolve` right; it's the same logic the Python relied on. Test `..`, absolute paths, and `.` explicitly.
- **`write_file` must create parent dirs** — the Worker writes `src/foo/bar.ts` into a fresh project; missing this breaks scaffolding.
- **Preserve error strings** — the phase markdown and the model's recovery behavior were tuned against this exact wording. Wrap each in `{ "error": "<same text>" }` per V1/02.
- **Skip-dir set matters for TS:** a Worker that just ran `npm i` has a huge `node_modules` — searching it would blow the match cap and the token budget.
- **Forward-slash paths** in `search_in_files` output regardless of host OS (Windows-first, but keep paths POSIX-style for the model).
- Tokens unaffected here, but large `read_file`/`search_in_files` outputs feed the window — V1/06 truncates the *audit preview*, not the tool result itself.

## Acceptance

- `run start hello-world`, `/swap worker`: ask "what files are here?" → `list_files` returns the scaffolded files.
- Ask it to write `src/index.ts` with some content → `write_file` returns `Wrote N characters to 'src/index.ts'.` and the file exists on disk under `projects/hello-world/`, with `src/` created.
- A model-issued `read_file` with `path: "../other-project/secret"` → structured error `Path '../other-project/secret' escapes the project directory`; the turn continues.
- `edit_file` on a string appearing twice → the multi-match error with the exact count; file unchanged.
- `search_in_files` for a token present in two files → both `path:lineno: line` rows, `node_modules` excluded.
