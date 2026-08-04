# Smooth the new-project path

**Category:** Onboarding

Starting a project is the roughest path in the product. Every step is individually defensible; the
sequence is not.

Today: `/new-project <name> <stack>` scaffolds `projects/<name>/` and then tells you to restart,
because the sandbox mount is fixed by `scripts/run.mjs` at boot and the session is locked to one
project. After the restart the scaffold is uncommitted by construction (`git init`, no commit), so the
first `/run` **refuses** with the dirty-tree halt and you go commit the baseline by hand. So: scaffold
→ exit → restart → commit manually → plan.

Two independent problems.

**The restart.** The session is locked to its project because `ACTIVE_PROJECT` picks the bind mount
before Node starts. Worth fixing so `/new-project` can hand you straight into the project it just
made, and so switching projects does not mean quitting.

**The dirty-tree refusal.** The halt itself is right — a review must capture exactly one task's
changes, and a stray scaffold in the diff would corrupt the first review. What is wrong is that the
tool creates the dirty state, knows exactly why it is dirty, and then refuses to act on it. The
scaffold is a known, closed set of files (`.gitignore`, `docker-compose.yml`, `README.md`,
`PRODUCT_SPEC.md`, `backlog/README.md`), so committing it is not a judgement call.

Candidate fixes, in increasing order of reach:

- `/new-project` commits its own scaffold as the baseline, so the project starts clean. This is the
  smallest change and removes the refusal entirely for the common case.
- `/run`'s dirty-tree halt names the offending paths rather than only explaining the rule, so a tree
  dirtied by something else is diagnosable without leaving the app.
- A `/project <name>` that re-execs the process against the new mount (or a mount that is switchable at
  runtime), which removes the restart.

## Open decisions

- Whether `/new-project` committing the scaffold conflicts with the intent that git stays
  model-driven. It is a **user** command, not a phase, so it seems clear — but it is the first commit
  in a project's history and the user may want to write it.
- Whether project switching is worth having at all, given `docs/phases.md` states the session is locked
  to one project on purpose. If it is not, say so in the doc and keep only the scaffold-commit fix.
