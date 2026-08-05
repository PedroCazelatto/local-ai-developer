# Add a glob-by-path tool

**Category:** Harness capability

Nothing answers "which files match `**/*.test.ts`?" The model has to walk directories — which it cannot
do below the project root today, see
[list-files-subdirectories.md](list-files-subdirectories.md) — or grep for content it hopes is unique to
those files.

## Why this shape

From [harness-gaps-vs-claude-code.md](harness-gaps-vs-claude-code.md). In Claude Code this is one of the
most-used tools, and the reason is worth stating precisely: **it is how you learn what exists without
reading anything.** A glob returns paths. Paths are the cheapest possible unit of knowledge about a
codebase, and a great many questions terminate there — is there a test file for this module, does this
project use `.tsx`, where are the migrations — without a single byte of content entering the window.

That is the whole argument for it on a 16k budget. It is not a convenience over `list_files`; it is the
tool that lets a phase orient itself for tens of tokens instead of thousands, and it is the natural first
call before either [search-in-files-context-lines.md](search-in-files-context-lines.md) or
`read_file`.

Two details from the Claude Code version that are load-bearing rather than incidental:

- **Sort by modification time, not alphabetically.** In a repo the model is actively changing, "what did
  I touch most recently" is usually the question behind the glob, and mtime order answers it for free.
- **Return paths and nothing else.** No sizes, no counts, no summaries. The value is entirely in how
  little it costs; anything added to each row multiplies by the number of matches.

## Open decisions

- **Whether it is a new tool or a mode of `list_files`.** They overlap heavily — a glob of `*` at depth 1
  *is* a listing. One tool with a pattern parameter is less surface for a small model to choose wrongly
  between; two tools are each simpler to describe in the generated `# Your Tools` block.
- **Which glob syntax, and implemented by what.** Node's `fs.glob` (Node 22+) versus a dependency versus
  a small hand-rolled matcher. The choice constrains what patterns the phase prompts can teach, so it
  should be settled before any prompt mentions the tool.
- **The result cap.** Same problem as everywhere else: `**/*` in a project with dependencies installed
  returns tens of thousands of paths. Cap it and say so.
