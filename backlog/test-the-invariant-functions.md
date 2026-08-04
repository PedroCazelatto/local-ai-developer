# Test the pure invariant functions

**Category:** Engineering quality

The orchestrator has no tests — `constitution.md` exempts it ("The orchestrator codebase does not
require tests"), so `tsc --noEmit` is the only automated gate over ~15k lines. The exemption is what
creates the risk: the invariants the whole design rests on are pure, dependency-free functions that
are trivially testable and are currently re-verified by hand, once, on the day they are written.

The functions worth pinning — no Docker, no Ollama, no terminal:

- `verdictGitConflict` — the rule that a `pass` may leave nothing uncommitted and a `fail` must name
  every uncommitted file. This is the check that stops the model's self-report from beating git.
- `resolveInProject` — the path-escape boundary for every host-side file tool.
- `replaceStatus` (`backlog.ts`) — surgical frontmatter rewriting: CRLF, no fence, unterminated fence,
  no `status` key.
- `nextRunnableTasks` / `taskSkipReason` — dependency gating, including a `depends_on` pointing at an
  id that does not exist.
- `readTaskFile` field readers — `readStatus` / `readOrder` / `readDependsOn` / `deriveTitle`, each of
  which has a forgiving branch and a fail-loud branch that must not swap.
- `StreamFilter` and `recoverToolCalls` — the two places a model's malformed output is parsed.
- `taskBranchName` — including the case where the id's leaf already ends with the title slug.
- `addTokenCounts` — the null-poisons-the-sum rule that keeps a missing metric from being reported as
  a real total.
- The width layer — `visibleWidth`, `wordWrap`, `truncateToWidth`, `codePointWidth` — where a wide
  glyph or an SGR sequence being counted wrong corrupts the pinned rows.

Deliberately out of scope: anything needing a live model, a container, or a real terminal. Those stay
on the existing "drive it with a throwaway script" and terminal-emulator-harness rules.

## Blocked on a decision

This contradicts `constitution.md` as written, so it cannot be started until the user decides whether
to amend the *Testing* section — and if so, whether the scope is "pure functions only" (as above) or
something broader. **Do not amend the constitution as part of this task.** Ask first.
