# Three drifts between `backlog.ts` and its own documentation

**Category:** Execution loop

`src/core/session/backlog.ts` is the file the scheduler reads the world through — which task runs
next, what it is called, whether it is done. Backlog item 2 pinned 88 tests across its readers and
writers and found three places where the code and its own comments disagree. All three are pinned as
*current* behaviour with a note; **none is fixed, and the tests assert what the code does today**, so
each fix here also changes a test. That is deliberate.

They are filed together because they share a file, a reviewer and a test suite — not because they
share a cause.

## 1. `taskSkipReason` and `nextRunnableTasks` do not skip identically

`nextRunnableTasks`'s JSDoc says it is *"shared by the single-task `/run` path and the batch driver
(V3/05) so both skip identically."* They diverge on exactly one status:

| status | `nextRunnableTasks` | `taskSkipReason` |
|---|---|---|
| `in_progress` | filtered out — it selects `status === 'pending'` | returns `null`, i.e. runnable |

So **`/run <id>` will start a task the batch driver would never pick.** In practice that is probably
the useful behaviour and possibly the intended one: it is what lets a user resume a task a crashed or
cancelled window left mid-flight, and `/run <id>` naming a task explicitly is the deliberate gesture
that ought to override a default. Compare `record-attempted-tasks.md`'s answered #3a and #5a, which
draw exactly that distinction for the new `failed` status — a bare selector skips, a named id retries.

**The defect is the sentence, not necessarily the behaviour.** But one of them is wrong, and until
somebody decides which, the next person to touch either function will "fix" the divergence in
whichever direction they read first.

**Open:** is `in_progress` runnable by name on purpose? If yes, the JSDoc is rewritten to say the two
paths skip identically *except* for `in_progress`, and why. If no, `taskSkipReason` grows a branch.
Do not answer it by making them agree.

## 2. A `readme.md` becomes a phantom task

`collect()` filters directory entries with:

```ts
entry.name.toLowerCase().endsWith('.md') && entry.name !== LEVEL_DOC
```

The extension test is case-insensitive; the level-doc test is a case-**sensitive** exact comparison.
So a level doc written `readme.md` or `Readme.md` is not recognised as the level doc, falls through as
an ordinary task file, and appears in the backlog as a task titled "Readme".

This is a Windows and macOS defect specifically — on a case-insensitive filesystem `readme.md` and
`README.md` are the same file, so a user or a tool that creates one with the wrong casing gets a
phantom task and no error. `docs/product.md` commits to OS-agnostic reach, which is what makes this
worth fixing rather than declaring a convention.

**Open:** does the fix lowercase both sides of the comparison, or should a mis-cased level doc be a
loud `BacklogError` instead? Silently accepting `readme.md` is friendlier; refusing it keeps one
spelling in the tree, which matters because the level doc's name is also what `docs/repo-layout.md`
tells a reader to look for.

## 3. `replaceStatus` is less surgical than "verbatim" claims

Its contract is to rewrite the `status` key and leave the rest of the file alone. Two ways it does not:

- **One CRLF anywhere normalises the whole file.** A file with mixed endings comes back entirely CRLF.
  Every unrelated line shows as changed in the diff, which is exactly what the "preserve the rest
  verbatim" promise exists to prevent — and it lands in a repo that genuinely does carry mixed endings
  (`rules/phases/*.md` is CRLF while `rules/prompts/*.md` is LF, both matching their blobs under
  `core.autocrlf`).
- **`  status  :  pending` loses its indentation.** Minor, and arguably an improvement — but it is not
  "verbatim", and a frontmatter key is not obviously the place to normalise someone's whitespace.

Neither breaks anything today. They are filed because the comment makes a promise the function does not
keep, and because a task loop that commits the backlog file — which
[record-attempted-tasks.md](record-attempted-tasks.md) is about to make it do — turns a whole-file
line-ending rewrite into a commit diff nobody can read.

**Open:** preserve the original endings line by line, or state in the comment that normalisation is
intended? The second is cheaper and might be the right answer, but it should be a decision.

## Why it sits where it does

Independent of everything, and all three are small. They are filed rather than folded into backlog
item 1's `src/core/session` wave for the reason every defect found this pass was: a behaviour change
buried inside a mechanical refactor is a change nobody reviews. That wave will relocate
`nextRunnableTasks`, `taskSkipReason`, `replaceStatus` and `collect` into their own files and update
item 2's tests to match — land it first, then these against the settled layout.

Read alongside [record-attempted-tasks.md](record-attempted-tasks.md), which adds a fifth
`TaskStatus` and a fourth committer to this same file. Drift 1 in particular is about how the two
`/run` paths treat a status, and that item adds a status they must both treat consistently.
