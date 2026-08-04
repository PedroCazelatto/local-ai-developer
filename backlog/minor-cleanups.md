# Minor cleanups

**Category:** Repo hygiene

Three small, unrelated defects found during a repo assessment. Bundled into one file because none of
them is worth a task of its own. Ship them together in one commit and delete this file; if only some
of them ship, trim this file down to what is left rather than deleting it.

## `run.mjs` interpolates the project name into a shell command

`scripts/run.mjs` runs every child with `shell: true`, and the `start` verb builds its command by
string interpolation:

```js
run(`npm run dev -- ${project}`, { ACTIVE_PROJECT: project });
```

So `npm run start -- "foo; <anything>"` reaches the shell. This is a local, single-user launcher and
the argument comes from the person typing it, so the practical risk is a typo doing something
surprising rather than an attack. It is still the one place in the repo where an unvalidated string is
handed to a shell, while everything else — `runGit`, the tool dispatcher — is deliberately argv-only
with no shell.

Fix: pass an argv array instead of a formatted string, or validate `project` against the same
`SAFE_NAME` pattern `/new-project` already enforces (`^[a-zA-Z0-9._-]+$`). The second is smaller and
also gives a clear error for a name that could never be a project directory anyway.

## `.gitignore` claims a `hello-world` exception it does not implement

The entry reads:

```
# Projects (except hello-world - example project)
projects/
```

There is no negation pattern, so `projects/hello-world/` is ignored like every other project. Either
add the negation (`!projects/hello-world/` plus the parent-directory rules git needs to descend into
an ignored path) or drop the parenthetical so the comment matches the behavior.

Decide which by answering: is the example project meant to ship with the repo? `README.md` does not
mention it, and `docs/repo-layout.md` describes `projects/` as "each child is its own git repo" —
which argues for dropping the comment.

## `switch-phase-tool.md` links a backlog file that no longer exists

`backlog/switch-phase-tool.md` says it "**depends on** [phase-context-history.md](phase-context-history.md)
— build that first." That task shipped in `3cc8b7b` and its file was deleted with it, exactly as the
backlog convention requires, so the link is dead.

The dependency is satisfied — phase contexts are titled and addressable now — so the fix is to replace
the link with a plain statement that the prerequisite has landed, and point at
`docs/mental-model.md` for what it delivered.
