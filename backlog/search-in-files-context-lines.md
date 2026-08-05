# Give search_in_files context lines, and a cheaper default mode

**Category:** Harness capability

`src/tools/search-in-files.ts` is literal-substring only: case-sensitive, no regex, no context lines, no
paths-only mode.

The one to add first is **context lines**. With a few lines either side of a match, a weak model can
often answer its question straight from the search result and never call `read_file` at all — which is
why this belongs to the same effort as [bound-read-file-output.md](bound-read-file-output.md) rather than
to a general search-quality wishlist. Case-insensitive search and a paths-only mode are cheap additions
on the same pass.

## Why this shape

From [harness-gaps-vs-claude-code.md](harness-gaps-vs-claude-code.md). Claude Code's `Grep` is worth
copying in one specific respect that is easy to miss: **its default output mode is the cheapest one.**
`files_with_matches` — paths only, no content — is what you get unless you ask for `content` or `count`,
and even `content` carries a `head_limit` that defaults to 250 lines with an `offset` for paging.

The reasoning generalizes past that tool. A search answers two different questions, and they have very
different prices:

- *"Where does this live?"* — needs paths. Cheap, and it is the majority of searches.
- *"What does it say there?"* — needs lines. Expensive, and only worth paying once you know where.

Today this tool always answers the second question, so the first one is paid for at the second one's
price, up to 200 matches at a time. Making paths-only available is half the fix; making it the **default**
is the half that changes behavior, because a small model takes whatever the tool gives it.

Context lines are the other side of the same trade: when the model *does* want content, three lines
either side of a match are usually enough to decide, and they cost a fraction of the file the model would
otherwise read to find out.

## Open decisions

- **Whether paths-only becomes the default**, which changes behavior for every existing prompt that
  assumes matching lines come back, or stays an opt-in parameter. The phase instruction sets under
  `rules/phases/` would need to teach the two-step search either way.
- **Whether regex is added at all.** It is the most-requested shape and the one with a real
  denial-of-service edge — a catastrophically backtracking pattern from a confidently-wrong model wedges
  the turn with no cancel to fall back on (see [steer-a-running-turn.md](steer-a-running-turn.md) and
  [cancel-an-in-flight-turn.md](cancel-an-in-flight-turn.md)). Fixed strings plus case-insensitivity
  covers most of the value with none of that.
- **What the 200-match cap becomes** once matches can carry context lines. 200 matches × 7 lines is not
  a bounded result any more, so the cap has to move to a line or token budget rather than a match count.
