---
name: documentation
description: README scope and section order for a project under development, when a doc-comment is warranted and what goes in it, don't restate the code, keep PRODUCT_SPEC and notes current. Use when writing or reviewing docs, READMEs, or code comments.
---

# Standard: Documentation

Document the *why* and the non-obvious; keep the README and specs matching the code as it actually is.

- README for a project under development covers, in order: title/one-liner → setup and run → usage → project layout → status/roadmap.
- Document *why*, not *what* — a comment that restates the code is noise; delete it.
- Write a doc-comment only when behavior, a contract, or a constraint is not visible from the signature.
- A doc-comment states inputs, outputs, side effects, and what it throws/raises — not a line-by-line retelling.
- Prefer intention-revealing names over explanatory comments.
- Comment the surprising, the workaround, and the boundary; link the reason or issue.
- Keep `PRODUCT_SPEC.md` and planning notes current as scope changes — stale docs mislead.
- Keep docs next to the code they describe, and move them when that code moves.
- Keep README run steps matching the actual scripts and commands.
- No commented-out code as "documentation" — version control already remembers it.

**Do:** `// Ollama drops the oldest tokens past num_ctx, so we summarize before that.`
**Don't:** `// increment i` — restates the code.

**Do:** keep the README's run command in sync with the real script.
**Don't:** let setup steps drift from what the repo actually does.
