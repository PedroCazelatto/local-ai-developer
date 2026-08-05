# Bound read_file, and number its lines

**Category:** Memory / context

`src/tools/read-file.ts` returns the entire decoded file. There is no cap, no line range, and no
truncation.

This is inconsistent with every other output path in the repo — `execute_command` and `run_in_project`
truncate head+tail, `search_in_files` stops at 200 matches, `git_inspect` is bounded by
`REVIEW_DIFF_BUDGET` — and it is the tool the model reaches for most. At the default 16384 with a
system prompt of roughly 2–2.5k (see [per-window-num-ctx.md](per-window-num-ctx.md)), one 900-line
source file is most of the Worker's window.

What it needs:

- `offset` and `limit` parameters, and a default line cap when neither is given.
- **Line-numbered output.** This is the quiet half of the change: line numbers make `edit_file`
  targeting easier for a weak model, make its failure messages diagnosable, and let a phase ask for a
  range on the second read instead of the whole file again.
- A truncation notice that states what was withheld and how to ask for it, so a cut file never looks
  like a short one.

## Why this shape

The comparison this came from is in [harness-gaps-vs-claude-code.md](harness-gaps-vs-claude-code.md).
The specific mechanics worth copying, because they are the parts that make a bounded read usable rather
than merely cheap:

- **The cap is the default, not a flag.** Claude Code's `Read` reads up to 2000 lines unless told
  otherwise, and its own tool description tells the model "when you already know which part of the file
  you need, only read that part." A cap the model has to opt into is a cap that never fires.
- **Numbered output is what makes a *second* read unnecessary.** With `1→` prefixes the model can cite
  `file:line` back to itself and to the user, target an edit without re-reading, and ask for
  `offset: 340, limit: 60` instead of the whole file. Unnumbered output forces the model to re-read to
  re-locate, which is how one expensive read becomes three.
- **A truncation notice must name what is missing.** A silently cut file is worse than a refused read:
  the model reasons over a partial file believing it is whole, and the Reviewer then reviews an edit
  founded on a file that does not exist. The notice is the guard, not a courtesy.

Line numbers also interact with [read-before-edit-guard.md](read-before-edit-guard.md): together they
make an `edit_file` failure diagnosable, because the model can be told which line it was looking at when
its `old_string` stopped matching.

## Open decision

**What the default cap is, and in what unit.** Lines are what a model reasons in and what pair with
`offset`/`limit`; bytes are what actually bound the window. A line cap with no byte backstop lets one
minified file through. Both, with whichever hits first winning, is the safe answer but needs the
truncation notice to say which one fired.
