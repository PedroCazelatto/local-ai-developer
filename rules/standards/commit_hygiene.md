---
name: commit-hygiene
description: Small single-purpose commits, imperative subject under ~50 chars, body explains the why, don't mix refactor with behavior, each commit builds green. Use when committing work or reviewing commit structure and messages.
---

# Standard: Commit Hygiene

Each commit is one logical change with a clear imperative subject and a body that explains why.

- One logical change per commit; if the subject needs an "and", split it.
- Subject line in the imperative mood, under ~50 characters, no trailing period.
- Separate subject from body with a blank line; wrap the body at ~72 columns.
- The body explains the *why* and context — the diff already shows the *what*.
- Don't mix a refactor with a behavior change in one commit; separate them.
- Each commit builds and passes its tests on its own.
- Keep unrelated formatting and whitespace churn out of a behavior commit.
- Reference the task or story the commit serves when it helps a reader.
- Follow the repo's type-prefix convention if it has one (e.g. `feat:`, `fix:`, `docs:`).
- Never commit secrets, generated artifacts, or commented-out code.

**Do:** `fix: reject empty task ids in backlog loader`
**Don't:** `updated stuff` — no scope, no intent.

**Do:** two commits — refactor first, then the feature on top.
**Don't:** one commit that both moves code and changes behavior.
