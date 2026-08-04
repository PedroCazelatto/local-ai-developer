# Close the symlink hole in the host-side file tools

**Category:** Sandboxing / security

`docs/sandboxing.md` opens with "Hard rule: the model touches only Docker, never the host filesystem.
Every command it runs and **every file it edits** happens inside a container." The second half is not
true, and the gap between the claim and the code is the actual defect.

`write_file`, `edit_file`, `read_file` and `search_in_files` run **host-side**, scoped by
`ctx.resolve` → `resolveInProject` (`src/tools/context.ts`). That check is *lexical*: it calls
`path.resolve` and compares the prefix. It never calls `realpathSync`, and Node's `writeFileSync` /
`readFileSync` follow symlinks.

The path in: `execute_command`'s guard only looks for `..` tokens, so `ln -s / esc` passes it
untouched. `/workspace` is a bind mount of `projects/<name>`, so a link created inside the container
appears inside the project directory on the host. `write_file("esc/etc/…")` then resolves lexically to
a path under the project root, passes the prefix check, and is written through the link.

Stated honestly: this was found by reading, not by exploiting it, and on Windows + Docker Desktop the
link may not materialize on the NTFS side (on Linux it will). The model is also not adversarial. The
reason to fix it anyway is that a doc asserts a guarantee the code does not provide, and by the
constitution's own standard that is exactly the kind of gap that must not exist.

What it needs:

- `resolveInProject` resolves the **real** path (`realpathSync` on the deepest existing ancestor, so a
  file that does not exist yet still validates) before the prefix comparison.
- The same treatment for the read side — a link is an exfiltration path into the context window, not
  just a write path out.
- `docs/sandboxing.md` corrected to say plainly that the file tools are host-side and path-scoped,
  while the shell tools are container-scoped. That doc edit is review-gated: hand the diff over, never
  auto-commit it.

## Open decision

Whether to keep the file tools host-side and harden the check (small, local), or move the writes
through the sandbox so the doc's original claim becomes true (larger, and it changes how every file
tool reports errors). The first is proposed above; the second is the user's call.
