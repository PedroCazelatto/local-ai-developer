# Constitution

Binding engineering constraints for building **the orchestrator itself**. These are invariants:
**follow every rule in this file by default.** Deviate only when the user *explicitly* tells you to
override a specific rule — never assume an exception, infer one, or let a general instruction quietly
override a rule here; if anything seems to conflict, the constitution wins unless the user says
otherwise. A spoken override applies only to that one case; making an exception permanent means
editing this file first.

Scope note: this governs the **orchestrator's own TypeScript code**. The *local Ollama model's*
code-quality standards are a different thing and live in [rules/standards/](rules/standards/); the
model never reads this file. The split:

- **[CLAUDE.md](CLAUDE.md)** — the index: the prime directive, the working rules, and links to the
  [docs/](docs/) files that describe *what* the project is and how it behaves.
- **constitution.md** (this file) — the *how*: the quality bar every change must clear. Code
  practices and implementation rules only; product description belongs in [docs/](docs/).

## Language & style

- **TypeScript on Node** (latest LTS), `npm` with [package.json](package.json).
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
- **Exception — the governance docs.** The commit rules above stop at [CLAUDE.md](CLAUDE.md), this
  file, and everything under [docs/](docs/): finished or not, they are never committed for the user.
  Everything else you touch — including the phase and standards files under [rules/](rules/) — is
  committed like ordinary work. See *Instruction integrity* below.

## Instruction integrity

- The governance docs — [CLAUDE.md](CLAUDE.md) (the index), this file (the how), and every file under
  [docs/](docs/) (what the project is) — **must never mutate silently.** Your edits to them are
  **never auto-committed**: warn the user that the change needs review, then let them commit it
  manually. This is the meta layer that dictates what every other change must do, and the one place a
  silent edit would be hardest to catch.
- **The phase and standards files under [rules/](rules/) are NOT gated for you.** Edit them and
  commit them like ordinary work (*Git workflow* above); the user reviews your diff the way they
  review any commit. This is a separate rule from a different actor: when the *local model* rewrites a
  `rules/` file at runtime (the Retro phase), the orchestrator still leaves that edit uncommitted for
  a human to review — see [docs/phases.md](docs/phases.md). A confidently-wrong local model editing
  its own instructions is not the same as you editing them.
- **Editing a governance doc needs no permission; committing it needs approval.** Make the edit when
  it is warranted — do not ask first, and do not stall the work to request it. Then stop at the
  commit: leave the change in the working tree, say what changed and why, and let the user review and
  commit it themselves. **The gate is the commit, not the edit.** This is the one place where *Git
  workflow*'s "finishing work means committing it" does not apply — here, finishing means handing the
  diff over.

## Documentation currency

- **This constitution MUST be kept up to date on every commit — it must never carry outdated
  information.** Any commit that changes a rule, convention, invariant, file-layout assumption, or
  workflow described here updates this file **in that same commit**. A rule that no longer matches
  the code is worse than no rule: stale guidance is a defect, not a cosmetic lag. The same duty
  applies to [CLAUDE.md](CLAUDE.md) and the [docs/](docs/) files it indexes — if a change makes a doc
  wrong, correcting it is part of that change, not a follow-up.
- This does **not** relax *Instruction integrity* above: an edit to any governance doc is still
  review-gated — surfaced for the user and committed by them, never silently auto-committed. It is
  simply never allowed to lag behind the code it describes.

## Terminal UX

- Prioritize **user experience** in the terminal interface — persistent REPL, `clack`/`chalk`/`ora`.
  The UX is part of the product, not an afterthought.
- **Finished output is append-only and never revisited.** Scrollback + copy/paste is the priority (the
  Rich `Live(screen=True)` TUI was abandoned precisely because it blocked copy/paste). Never take the
  alt-buffer. Exactly two things may repaint, both of which are *live* rather than history:
  - the **in-progress line** of a streamed reply (it is still under the cursor and has not scrolled),
    which is rewritten once, formatted, when its newline arrives; and
  - a **transient widget's own frame** (the `ask_user` panel, the spinner), which must erase itself and
    leave exactly one static, copyable summary in the buffer.

  The **pinned bottom rows** are the one thing outside that rule, because they are outside the history:
  the status bar and the input fence raised while a turn runs live on rows reserved by a DECSTBM scroll
  region, so nothing that scrolls can reach them and nothing they paint can reach the scrollback. They
  repaint in place as often as they like. Taking or releasing those rows must stay lossless — scroll the
  region to free a row, never paint over one that holds output.

  Anything already scrolled is immutable. Clear rows with `ESC[2K` on rows you wrote yourself — never
  `ESC[0J`, which erases to the end of the display and wipes the pinned status rows.
- **The model writes plain markdown; the orchestrator owns every color.** The construct→color mapping
  lives in `theme.ts` alone, so the palette is retuned in one place. The model is told its markdown is
  rendered, and told to emit **no ANSI escapes** — a model must never choose a color, and a hallucinated
  one must never be able to fight the theme.

## Testing

- **The orchestrator codebase does not require tests.** Test-first is a rule for the
  project-building phases (the Worker in particular) and lives in the phase prompts under
  [rules/](rules/) — not in Claude Code's own workflow on this repo.

## Repo hygiene

- **Never write the user's name into any file** in this repo.
- When a design choice isn't covered here, in the docs indexed by [CLAUDE.md](CLAUDE.md), or in the
  code, **do not assume — ask.**
