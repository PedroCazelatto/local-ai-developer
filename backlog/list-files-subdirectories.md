# Let list_files see a subdirectory

**Category:** Harness capability

`src/tools/list-files.ts` takes no parameters and lists the project root, non-recursively. There is no
way to list `src/core/`.

Combined with the deliberate absence of a shell in the planning phases, this means **Discovery, Design
and Breakdown cannot enumerate a subdirectory at all.** The rationale comment in `phase-tool-names.ts`
says `read_file` / `list_files` / `search_in_files` "already cover every inspection a spec or a backlog
needs" — they do not, and that gap is currently documented as a policy choice rather than the hole it is.

What it needs:

- An optional `path` parameter and an optional depth, scoped by the same `ctx.resolve` every other file
  tool uses (and therefore inheriting whatever
  [resolve-symlinks-in-path-scoping.md](resolve-symlinks-in-path-scoping.md) settles).
- The rationale comment in `phase-tool-names.ts` corrected **in the same change**, so it stops asserting
  coverage the tools do not have.

## Why this shape

From [harness-gaps-vs-claude-code.md](harness-gaps-vs-claude-code.md). This is the cheapest item on that
list to justify: three of the five phases cannot answer "what is in this folder" today, and the workaround
they are pushed into — `search_in_files` for a string they hope is unique to the files they want, or
`read_file` on a guessed path — costs far more window than the listing would have.

The depth parameter matters more than it looks. A recursive listing of a `node_modules`-bearing project
is itself a context bomb, so bounded depth is not a nicety: it is what makes recursion safe to offer to a
model that will pass `depth: 99` to be thorough. Cap it, and say in the output that it was capped — same
rule as the truncation notice in [bound-read-file-output.md](bound-read-file-output.md).

## Open decision

**Whether ignored paths are filtered.** A listing that shows `node_modules/`, `.git/` and `dist/` is
technically honest and practically useless. Reusing the project's `.gitignore` is the obvious source of
truth, but it makes a read-only inspection tool depend on git state, and a file the model just wrote but
has not committed must never be hidden from it.
