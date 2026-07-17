# Constitution

Binding engineering constraints for building **the orchestrator itself**. These are invariants:
**follow every rule in this file by default.** Deviate only when the user *explicitly* tells you to
override a specific rule — never assume an exception, infer one, or let a general instruction quietly
override a rule here; if anything seems to conflict, the constitution wins unless the user says
otherwise. A spoken override applies only to that one case; making an exception permanent means
editing this file first.

Scope note: this governs the **orchestrator's own TypeScript code**. The *local Ollama model's*
code-quality standards are a different thing and live in [rules/standards/](rules/standards/); the
model never reads this file. The two-doc split:

- **[CLAUDE.md](CLAUDE.md)** — the *objective*: what we're building and why.
- **constitution.md** (this file) — the *how*: the quality bar every change must clear.

## Language & style

- **TypeScript on Node** (latest LTS), `npm` with [package.json](package.json). The Python code is
  **reference-only** and is deleted at parity — **never add new Python**.
- **Naming:** `camelCase` for values/functions, `PascalCase` for types/classes, **kebab-case** file
  names.
- **Strict `tsconfig`** (`strict: true`).
- **Never use `any`.** Prefer concrete types, `interface`/`type`, generics, or `unknown` with
  narrowing. Reach for a localized `as` / `// @ts-expect-error` **only** when the type is genuinely
  unknowable, and comment why.

## Code structure & clarity

- **Always follow Clean Code and SOLID.** Every change respects both: small single-purpose units,
  intention-revealing names, no god objects, dependency inversion over hard-wired concretions.
- **One function per file — least responsibility.** Each code file holds **exactly one function**,
  so its responsibility is as small as possible. The kebab-case file name names that function's job.
  No exceptions: a file that would need a second function means a second file.
- **Types and schemas go in sibling files, never inline with a function.** Declare them beside the
  function they serve, named `<name>.type.<ext>` for types and `<name>.schema.<ext>` for schemas
  (e.g. `parse-config.ts` pairs with `parse-config.type.ts` and `parse-config.schema.ts`).
- **Document complex functions at the call site.** When you call a non-trivial function, add a
  brief comment *where it is used* stating what the function does — so reading the calling file
  tells you the behavior without opening the function's own file.

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

## Git workflow

- **Finishing work means committing it.** When a piece of work is done, commit it — do not leave it
  sitting in the working tree waiting to be asked, and do not ask for permission to commit. "Done" is
  the trigger. (Pushing is not: only push when told to.)
- **Commit on the ACTIVE branch.** Whatever branch is checked out is where the work lands, `main`
  included. **Never create a branch on your own initiative** — branch only when the user explicitly
  says to. This overrides any default habit of branching off the default branch.
- **Exception — global instruction files.** The commit rules above stop at [rules/](rules/),
  [CLAUDE.md](CLAUDE.md), and this file: finished or not, they are never committed for the user. See
  *Instruction integrity* below.

## Instruction integrity

- The orchestrator's own instruction set — [rules/](rules/), [CLAUDE.md](CLAUDE.md), and this file —
  **must never mutate silently.** Edits to global instruction files are **never auto-committed**:
  warn the user that the change needs review, then let them commit it manually. (Project-repo
  artifacts follow the auto-commit policy in [CLAUDE.md](CLAUDE.md) — this exception is only for the
  orchestrator's own instructions.)
- **Editing them needs no permission; committing them needs approval.** Make the edit when it is
  warranted — do not ask first, and do not stall the work to request it. Then stop at the commit:
  leave the change in the working tree, say what changed and why, and let the user review and commit
  it themselves. **The gate is the commit, not the edit.** This is the one place where *Git workflow*'s
  "finishing work means committing it" does not apply — here, finishing means handing the diff over.

## Documentation currency

- **This constitution MUST be kept up to date on every commit — it must never carry outdated
  information.** Any commit that changes a rule, convention, invariant, file-layout assumption, or
  workflow described here updates this file **in that same commit**. A rule that no longer matches
  the code is worse than no rule: stale guidance is a defect, not a cosmetic lag. The same duty
  applies to [CLAUDE.md](CLAUDE.md) (the objective) — if a change makes either doc wrong, correcting
  the doc is part of that change, not a follow-up.
- This does **not** relax *Instruction integrity* above: a doc edit is still a global-instruction
  change — surfaced for the user's review and committed by them, never silently auto-committed. It is
  simply never allowed to lag behind the code it describes.

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
