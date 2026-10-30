# Three defects in the standards frontmatter parsers

**Category:** Engineering quality

Three defects found by backlog item 2's `src/context/` pass, in `parse-frontmatter.ts` and
`split-frontmatter.ts` — the pair that decides which standards the model can find and what it reads when
it loads one. Grouped because they share two functions, a reviewer and a test suite. All three are
pinned as *current* behaviour; **none is fixed.**

## 1. A UTF-8 BOM defeats both parsers, and one of them aborts boot

Both regexes anchor `^---` with no BOM tolerance — `parse-frontmatter.ts:17` and
`split-frontmatter.ts:12`. Driven directly:

| input | `parseFrontmatter` | `splitFrontmatter` |
|---|---|---|
| `---\nname: x\n…` | `{name:'x', description:'d'}` | `name:'x'`, body `'The body.\n'` |
| `\uFEFF---\nname: x\n…` | **throws** `Missing YAML frontmatter (leading --- block)` | `name:''`, body = **the entire raw file** |

**One standards file saved BOM-first aborts the orchestrator at boot** — and saving BOM-first is routine
for a Windows editor, on what is a Windows box.

**The reason this ranks near [22](truncate-to-width-measures-code-units.md) is not the failure, it is the
diagnosis.** `parseFrontmatter` takes the file path and names it in the error, so the user is told a
specific file is *"missing YAML frontmatter (leading --- block)"* — while looking at a file that visibly
has one. **A wrong error message costs more than a silent failure**, because it sends the reader to
inspect the one thing that is already correct.

The `splitFrontmatter` half is quieter and arguably worse: no throw, an **empty name** — so the slug
never matches and the standard is simply unreachable — and the raw `---` block handed to the model as
part of the body.

**The repo already disagrees with itself.** `src/core/session/split-task-frontmatter.ts:22` uses
`/^\uFEFF?---\r?\n…/` and tolerates a BOM deliberately. Two functions that were called `splitFrontmatter`
in one repo, one tolerant and one not — which is the *second* reason that name appears in the sweep's
collision record.

**Latent today:** all nine `rules/standards/*.md` were checked and none carries a BOM.

## 2. `splitFrontmatter` strips CRLF blank lines only partly

`/^\r?\n+/` is *one optional `\r`, then a run of `\n`* — so against `\r\n\r\n` it consumes the first pair
and stops. Measured:

```
LF    body -> '# Body\n'          <- every leading blank line dropped
CRLF  body -> '\r\n# Body\r\n'    <- exactly one dropped
```

**All nine standards files are CRLF.** `/^(?:\r?\n)+/` treats both alike.

**This was first reported as live and corrected to latent by driving the real tree.**
`loadStandardBody('clean-architecture')` returns a body starting cleanly at `# Manifesto`, because none
of the nine happens to have a blank line after its closing fence. **The correction is worth as much as
the defect**: it is one ordinary formatting edit from biting, and nothing warns you.

## 3. The two parsers disagree about a duplicated key

`parseFrontmatter` builds a `Map` and `set`s, so the **last** `name:` wins. `splitFrontmatter` `break`s
on the first match, so the **first** wins. Driven: `name: first` / `name: last` yields `'last'` and
`'first'` respectively.

A file repeating `name` is therefore **catalogued under one name and resolved under another** — listed by
`search_rules`, then unreachable by `load_rule`. Pathological input, and cheap to pin.

## Both standing conditions apply

- **The tests already assert the current behaviour**, deliberately, so fixing any of these changes its
  test.
- **None may ride along in a sweep commit** — and there is no excuse here: **`src/context/` closed at
  `daf08cf`**, so there is no refactor in flight to hide behind.
