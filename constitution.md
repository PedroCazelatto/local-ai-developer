# Constitution

Binding engineering constraints for building **the orchestrator itself**. These are invariants:
every change Claude Code makes to this repo must respect them, no exceptions without the user
changing this file first.

Scope note: this governs the **orchestrator's own TypeScript code**. The *local Ollama model's*
code-quality standards are a different thing and live in [rules/standards/](rules/standards/); the
model never reads this file. The three-doc split:

- **[CLAUDE.md](CLAUDE.md)** — the *objective*: what we're building and why.
- **constitution.md** (this file) — the *how*: the quality bar every change must clear.
- **task files** ([tasks/](tasks/)) — the *what*: the specific work in flight.

## Language & style

- **TypeScript on Node** (latest LTS), `npm` with [package.json](package.json). The Python code is
  **reference-only** and is deleted at parity — **never add new Python**.
- **Naming:** `camelCase` for values/functions, `PascalCase` for types/classes, **kebab-case** file
  names.
- **Strict `tsconfig`** (`strict: true`).
- **Never use `any`.** Prefer concrete types, `interface`/`type`, generics, or `unknown` with
  narrowing. Reach for a localized `as` / `// @ts-expect-error` **only** when the type is genuinely
  unknowable, and comment why.

## Correctness invariants

- **Token counts are always exact.** Read them from Ollama's response (`prompt_eval_count`,
  `eval_count`) and propagate that exact value through every consumer (status line, summarization
  trigger, audit log, `/resume` summaries). **Never** substitute a length-based estimate — estimates
  drift and they are the wrong basis for VRAM-safety decisions. If a metric isn't returned for a
  call, **surface that explicitly**; do not paper over it with a guess.

## Tools & side effects

- Tools run **autonomously** — no confirmation prompts.
- **Every tool call must be logged** for later audit.
- Grow the tool set **on demand** — add a tool when the model demonstrably needs one, not
  preemptively.

## Instruction integrity

- The orchestrator's own instruction set — [rules/](rules/), [CLAUDE.md](CLAUDE.md), and this file —
  **must never mutate silently.** Edits to global instruction files are **never auto-committed**:
  warn the user that the change needs review, then let them commit it manually. (Project-repo
  artifacts follow the auto-commit policy in [CLAUDE.md](CLAUDE.md) — this exception is only for the
  orchestrator's own instructions.)

## Terminal UX

- Prioritize **user experience** in the terminal interface — persistent REPL, `clack`/`chalk`/`ora`.
  The UX is part of the product, not an afterthought.

## Testing

- **The orchestrator codebase does not require tests.** Test-first is a rule for the
  project-building phases (the Worker in particular) and lives in the phase prompts under
  [rules/](rules/) — not in Claude Code's own workflow on this repo.

## Repo hygiene

- **Never write the user's name into any file** in this repo.
- When a design choice isn't covered here, in [CLAUDE.md](CLAUDE.md), or in the code, **do not
  assume — ask.**
