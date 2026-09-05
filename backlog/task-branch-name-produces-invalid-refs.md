# `taskBranchName` produces refs git rejects, and silently drops titles

**Category:** Execution loop

`src/core/session/task-branch-name.ts` builds the branch a task's work lands on. Its own comment says
it strips what *"git could choke on … rather than discover it at checkout time"*. It does not, and the
discovery happens at checkout time.

Found by backlog item 2 while pinning the function, and pinned there as *current* behaviour. **Both
defects are asserted by the tests**, so fixing them means changing those assertions — which is the
point: the tests record today's behaviour so that a change is deliberate rather than accidental.

## Defect 1 — an interior `..` survives, and git refuses the ref

`safeIdPath` strips leading and trailing dots per path segment, but not a `..` inside one. So
`id: 'a..b'` yields `task/a..b-go`, and git will not take it:

```
$ git check-ref-format refs/heads/task/a..b-go
(exit 1 — INVALID)
```

Verified against the real tool, not inferred from the rules. `git check-ref-format` rejects any ref
containing `..`, which is why this is a hard failure rather than a cosmetic one: the branch cannot be
created, so the task cannot start, and the failure surfaces from git rather than from the function
whose stated job was to prevent it.

Whether a task id can contain `..` today is a separate question from whether this function should
handle it. It claims to handle it. Note also that `resolveInProject` exists because `..` in
model-supplied strings is a live concern elsewhere in this repo — a task id is not model-supplied in
the same way, but the two should not disagree about whether `..` is worth stripping.

## Defect 2 — the leaf check is a suffix match, not a segment match

The header explains a deliberate case: when *"the id's own leaf already ends with"* the title slug, the
title is not appended again, so the branch does not read `task/07-add-login-add-login`. The check is a
plain `endsWith`, so it also fires when the leaf merely happens to end with those characters.

`id: '01-latest'` with title `'Test'` produces `task/01-latest` — the title is dropped, because
`'01-latest'.endsWith('test')`. The branch for a task called "Test" is now indistinguishable from the
branch for any other task whose id ends in `latest`.

This is *literally* consistent with the header as written, which is what makes it worth filing rather
than just fixing: the sentence describes a suffix match and the code performs one, but the intent is
plainly a **segment** match — the leaf ends with the slug *as a whole word*, preceded by a separator or
nothing at all. Fix the code and the comment together, or the next reader re-derives the same
ambiguity.

## The shape of a fix

Both are small and local to `safeIdPath` and the leaf comparison. The care needed is in the tests, not
the code: item 2 pinned 19 cases here, and at least two of them encode the current wrong answer.

## Decisions, open

- **Is `..` collapsed, replaced, or rejected?** Collapsing `a..b` to `a.b` keeps the id recognisable;
  replacing with `-` matches how the rest of the slug is built; rejecting outright turns a silent bad
  branch into a loud refusal at task-start, which may be the honest answer if a task id should never
  have contained `..` in the first place.
- **Does the fix run the full `git check-ref-format` rule set, or just the cases we have hit?** git's
  rules also forbid a trailing `.lock`, an `@{` sequence, a bare `@`, control characters, and more.
  Half of them are already handled incidentally. Deciding to be exhaustive is a different task from
  fixing the two known holes — and being exhaustive without saying so is how the comment came to
  over-claim in the first place.
- **Should the segment match require a separator, or also accept the whole leaf equalling the slug?**
  `id: 'add-login'` with title `'Add login'` is the degenerate case and it is not obvious which answer
  is wanted.

## Why it sits where it does

Independent, small, and nothing depends on it. It is filed rather than folded into backlog item 1's
`src/core/session` wave for the same reason as every other defect this pass turned up: a behaviour
change hidden inside a mechanical refactor is a change nobody reviews. The sweep will relocate this
function; land the sweep first, then this.
