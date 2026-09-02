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
  No exceptions: a file that would need a second function means a second file. **Cohesion is not an
  exception** — "these three belong together" is an argument for a folder, not for a file. **The bar
  is any function declaration, not any exported one.** A private helper is a second function and means
  a second file: `config.ts`'s three env resolvers were never exported, and that is precisely what made
  it a violation. **A `class` counts as a declaration too**, so a file holds one class *or* one
  function, never one of each: a class beside a function is two declarations and a violation. The
  corollary is the part that keeps being reached for the wrong reason — a file holding **only** a
  class conforms **not because a class is exempt**, since nothing here exempts one, but because it
  passes the same one-declaration test every other file passes. A file holding only constants, or only
  a value such as a shared client, passes for the adjacent reason that it declares none at all.
  **The one carve-out is `src/**/__tests__/**`**, for the reason given under *Testing* below.
- **What counts, exactly.** A top-level `function`, a top-level arrow const, a `class`, and a **function
  member — arrow property *or* method shorthand — of an object literal at module top level**. Nothing
  else. In particular:
  - **Method shorthand on an object literal counts, exactly as an arrow property does.** `execute(x) {…}`
    and `execute: (x) => {…}` are the same declaration written two ways, and the bar cannot depend on
    which spelling someone reached for. This is what makes most of `src/tools` a violation: a tool is
    `export const xTool = { name, description, execute(…) {…} }`, and that `execute` is a function
    declaration living in a file with other functions. **It does not contradict the class rule below.**
    A class's methods are exempt because the class is *itself* one declaration that owns them; an object
    literal declares nothing of its own, so its members are the only declarations there are.
  - **A class's methods do not count.** A class is one declaration however many methods it carries, for
    the same reason a function's locals do not count: **the methods are its implementation.** The
    existing class files stay whole.
  - **An arrow inside a function body does not count** — a local, a callback passed as an argument, or
    an object *built and returned* by a function. That last one is a closure-based handle, and its
    arrows are the function's implementation just as much as a local is.
  - **An arrow in a type position does not count**: `work: () => T` in a parameter list declares
    nothing.
  This leaves a **known hole**: free functions moved onto a class score one declaration instead of many.
  It is accepted, not closed. A rule that admits its own edge is more useful than one that pretends it
  has none — and the reviewer, not the counter, is what catches a class invented to duck the bar.
- **A split file survives only if it assembles the parts into an object.** An **assembler** is allowed:
  a file that imports single-function modules and composes them into **one object value** callers use as
  a single thing, and it **exports that object and no other value** — constants and functions alike are
  properties of it. Types are not values: `export type { Foo }` beside the object is allowed, and costs
  the import surface nothing, so callers take a concept's value and its type from one place. It holds
  no second function of its own, so it clears the rule. A file that would
  survive only by re-exporting the names individually — `export * from`, or `export { a, b, c }` — is
  **not** an assembler and does not survive: **delete it and repoint every importer at the file that
  owns the function.**
- **A model-facing tool is one file, and the tool is the unit of responsibility.** `src/tools/<tool>.ts`
  holds its `name`, `description`, `parameters` **and** `execute` together, and the file is named for the
  tool. **Do not extract `execute` into its own file.** Splitting a tool across files would divide one
  responsibility rather than separate two — the object exists to satisfy the **Ollama API tool type**,
  and every part of it describes the same single capability. `execute` is therefore that file's one
  declaration, however long its body, and it counts as one under *What counts, exactly* above.
  **All 23 tools take the same shape** — `{ name, description, parameters, execute(…) {…} }`, `execute`
  as method shorthand — and uniformity here is a requirement, not a coincidence: a reader who has read
  one tool has read the shape of all of them. Helpers a tool needs still leave the file, one function
  per file, exactly as everywhere else.

  > A tool file is thus the one place a substantial function body legitimately sits inside an object
  > literal. It is not a precedent for anything else. A command in `src/interface/commands/` looks
  > different on purpose: its object holds a one-line `run:` referencing an extracted function, because
  > a command's dispatch and its work genuinely are two responsibilities.
- **This reaches a directory's `index.ts` public barrel, with no exception.** Those are pure re-export
  modules, so they go the same way, and an import names the file that serves it rather than the folder.
  The cost was weighed and accepted: it turns every through-barrel import into a deep one. A re-export
  barrel is not an acceptable end state, and not something a split may leave behind as it goes — it is
  the vestige of a file that has stopped having a reason to exist. That prohibition is about a **split
  file** shelling itself out; a directory's own barrel was a different thing, and went on serving its
  importers until the pass that deleted it. **That pass has run: no directory barrel is left**, and the
  one `index.ts` that survives is `src/index.ts`, which exports nothing at all — it is the application
  entry point, not a barrel. A new one is a violation, not an intermediate state.
- **Any module-level value read across an import cycle must be read inside a function body.** This was
  first written for assemblers, but it is not about assemblers — it holds for **every exported value
  reached through a cycle**, a plain `ReadonlyMap` module as much as a composed object. When a module
  in the value's own dependency subtree needs it, it must read `theValue` (or `theObject.CONSTANT`)
  **inside a function body**. A module-evaluation-time read — a top-level `const x = theValue`, or a
  top-level destructure — runs before the binding is initialised and throws
  `Cannot access '<name>' before initialization`. Both directions were driven against Node's ESM
  loader; this is a measured constraint, not a caution, and the file that depends on it should say so
  in its header.
- **A type with an owning function lives in that function's file.** Declare an interface, type or union
  in the same file as the function it serves, above it — it is read where it is used, and it moves when
  the function moves. When several functions share a type and one of them plainly owns it, it lives
  there and the others import it from there. **This rule has not changed**, and most of the codebase's
  type placement rests on it.
- **A type no function owns gets its own file: one type, named `<kebab-type-name>.type.ts`.** A closed
  role union, a tool-call display contract, a stored row shape — anything the folder speaks rather than
  one function — becomes `blocker-row.type.ts`, `phase-load.type.ts`, `tool-call-display.type.ts`. One
  declaration per file is the same bar functions are held to, applied to the vocabulary. **There is no
  `types.ts`**, and no per-folder vocabulary module: that shape is retired, along with the
  one-spelling-per-folder clause it needed.
- **A dependency seam is not owned by the function that consumes it.** This is the line between the two
  rules above, and it is the one that is easy to get wrong: **a `Deps` or `Reporter` interface — anything
  the *caller* implements and passes in — gets its own `.type.ts`, even when exactly one function takes
  it.** A **result** type does fold, because one function produces it and nothing else can. The test is
  *which side of the call constructs a value of this type*: if it is the caller, the type is a contract
  between two files and belongs to neither; if it is the function, the function owns it.

  So `BatchDeps`, `BatchReporter`, `CompactDeps`, `DispatchDeps`, `TaskLoopDeps` and `TaskLoopReporter`
  are standalone modules, while `WorkerResult`, `ReviewerOutcome`, `FlushRequest`, `CommitResult`,
  `AbortedTurn` and `PhaseState` live in the file of the function that builds them. **Counting importers
  cannot tell these apart** — both shapes have exactly one — which is why the rule is stated in terms of
  who constructs the value rather than in terms of how many files mention the name.
- **`<name>.type.ts` no longer means what it once did, and the difference matters.** It used to name a
  **sibling** of a function file — a `<name>.ts` / `<name>.type.ts` pair. It now names a **standalone
  module holding exactly one unowned type**, and there is deliberately **no `.ts` file of the same
  stem**. Do not recreate the old pairing: a type that has a function to sit beside belongs *inside*
  that function's file, per the rule above.
- **Types importing types is fine.** A union and its members are separate files, and the union imports
  them. Nothing about one-type-per-file argues for keeping a family together in one module.
- **Schemas keep their sibling file**, named `<name>.schema.<ext>` (e.g. `memory-db.ts` pairs with
  `memory-db.schema.ts`). Types were folded back in because a type erases at compile time and costs the
  function file nothing; a schema does not — it is a runtime value with its own weight and often its own
  imports, so it stays out of the way. Schemas do not follow the type rule.
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

- **Functions with no heavyweight dependency are tested; nothing else is.** This reverses the earlier
  blanket exemption ("the orchestrator codebase does not require tests"), and only for functions that
  reach for none of the three: **no live model, no container, no real terminal.** The invariants the
  design rests on live in functions of exactly that shape, and they are expected to have tests.
  **Everything else stays exempt**, and stays on the rules it already had: drive it with a throwaway
  script that imports and calls the real functions, and verify rendering by replaying the real
  renderer through the terminal-grid emulator harness. **Never run the app to test a change.**
- **A test that reads the filesystem is still inside the scope.** `resolveInProject`'s entire job is
  to ask the filesystem what a path really points at, so it is pinned against real directories under
  the OS temp directory; a function private to its module is pinned through the exported entry point
  that reaches it. Neither is a live model, a container or a terminal, and both stay hermetic and
  self-cleaning. The line is drawn at the three heavyweight dependencies, not at purity in the
  strictest sense.
- **`node:test` + `node:assert`, and no new dependency for either.** Run them with `npm test`.
- **Tests live in a `__tests__/` subdirectory beside the code they pin**, one file per function under
  test and named after it. **A test imports the file that owns the function, never a barrel**, so
  moving a function is a one-line change to its test — and making that change belongs to the commit
  that moves it.
- **`src/**/__tests__/**` is exempt from one function per file.** A test file is a list of `test(...)`
  calls plus the fixtures and helpers those cases share. The rule's purpose — keeping a unit's
  responsibility as small as possible — is served by the file *under* test, not by the file that pins
  it, and prising a fixture apart from the cases that use it makes both harder to read. The exemption
  is scoped to that path and reaches nothing else; test files are likewise not counted in the
  one-function-per-file census.
- **A test pins the invariant, not the implementation.** A test that passes because it asserts what
  the code happens to do is worse than no test. Where current behaviour and the documented invariant
  disagree, pin the current behaviour, say so in a comment, and **raise the discrepancy** — never
  quietly promote a bug to a requirement, and never change the code to suit the test.
- Test-first remains a rule for the project-building phases (the Worker in particular) and lives in
  the phase prompts under [rules/](rules/). That is a different actor and a different codebase from
  this section, which governs Claude Code's own workflow on this repo.

## Repo hygiene

- **Never write the user's name into any file** in this repo.
- When a design choice isn't covered here, in the docs indexed by [CLAUDE.md](CLAUDE.md), or in the
  code, **do not assume — ask.**
