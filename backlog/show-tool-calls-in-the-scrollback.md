# Show what a tool call actually did

**Category:** Terminal UX

`src/core/session/turn-loop.ts:126` prints one line per tool call:

```
→ tool: read_file
```

No arguments, no result, no diff. So watching a session you cannot tell **which** file was read, whether an
edit landed, what a command exited with, or what was written into your project. The transient activity line
adds a live elapsed timer while the call runs (`running edit_file (1.1s)`) and then erases itself, which is
correct behavior for a transient widget — but it means the only thing left in the append-only history is the
tool's name.

With cancelling shipped, this is the largest remaining UX gap in the product, and it is the cheapest to
close: `args` is already in hand one line above the print, and every result already goes through the audit
log's single choke point.

What it needs:

- **The identifying argument on the call line.** `→ read_file src/core/ui/theme.ts`, `→ run_in_project npm
  test`, `→ search_in_files "resolveInProject"`. One field per tool, chosen per tool — not a JSON dump of the
  arguments object, which would be unreadable and unbounded.
- **A one-line result summary after it returns.** `← 340 lines`, `← exit 0 · 2.4s`, `← 12 matches in 5 files`,
  `← no match — nothing changed`. A failed call must be visibly a failure; today a refused `edit_file` and a
  successful one look identical from the outside.
- **A diff for the tools that change files.** `write_file` and `edit_file` are the two operations with lasting
  consequences, and they are the two you can currently see least. A compact +/- diff, or at minimum a
  `+12 −3` counter with the path.
- **Both lines styled through `theme.ts` only**, and both static once written — this is history, not a widget.

## Why this is not the same as a confirmation prompt

`constitution.md` says tools run autonomously with no confirmation prompts, and that stays: it is the right
call for a product whose stated mode is "start a batch and walk away." This task does not ask for approval, it
asks for a **record**. The analogue is not a permission gate, it is showing the diff after the fact.

The comparison this came from noted that Claude Code does both, and that the two are independent: the diff is
what makes an autonomous edit reviewable at a glance, and it would be worth having even with every prompt
removed. Right now the only durable record of what the model did to a project is `tool_audit.jsonl`, which
[inspection-commands.md](inspection-commands.md) exists because nothing can read back.

## Open decisions

- **Which argument identifies each tool.** Straightforward for the file tools; less so for `debate`,
  `ask_subagent`, `inbox_write` and `submit_verdict`, where the interesting field is long prose. Those may want
  a truncated first line, or nothing at all.
- **Whether the diff is shown inline or as counts.** A large `write_file` diff is itself a scrollback flood, and
  the scaffold written by `/new-project` would print five files' worth. A byte or line threshold above which it
  collapses to counts is probably necessary.
- **Whether sub-agent tool calls are shown at the same weight.** `subagents.ts:172` already prefixes them
  (`→ tool: X [sub:abc]`); a sub-agent doing twenty calls inside one parent tool call could bury the parent's
  own output.
- **How this interacts with the width layer.** These lines carry paths and commands, which are exactly the
  strings that overflow — they must go through `truncateToWidth` like every other measured row.
