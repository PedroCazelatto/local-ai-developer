# Re-running a `failed` task puts a stale `pending` into the stash

**Category:** Execution loop

Narrow, uncommitted, and harmless today — filed because the reasoning is not obvious from the code and
the next person to read that stash will be confused by it.

When a task that is **already** `failed` is retried with `/run <id>` and escalates again:

1. the loop's exit reverts the status to `pending`, hardcoded;
2. that makes the task file differ from HEAD, which says `failed`;
3. so `git stash push -u` **includes the task file**, holding `status: pending`;
4. `recordFailedAttempt` then writes `failed` back and finds it byte-identical to HEAD, so it commits
   nothing and correctly reports `recorded: true`.

The committed state ends up right. But the stash — the thing the user is invited to inspect to see
what the attempt did — now carries **a reversion of the record** alongside the attempt. Popping it to
look at the work would locally un-mark the task.

## Why the revert-to-`pending` is there at all

It is load-bearing on the **first** failure, and this is the part worth keeping in mind before
"fixing" it. Reverting to `pending` is what keeps the task file **byte-identical to HEAD** on that
path, and therefore *out* of the stash — which is what lets `recordFailedAttempt` write into a clean
tree and commit exactly one path. The wart is the second failure only, where HEAD has moved on and
`pending` is no longer HEAD's text.

## The fix, and why it was not made

Write back **the status found at the start of the attempt** rather than a hardcoded `pending`. That
restores the byte-identical property in both cases and the stash stops carrying the file at all.

Not made because it is undocumented: it changes what the loop writes on every non-passing exit, not
just this one, and `cancelled` reaching `pending` is a rule the code argues for in its own comment.
Reworking that is a decision about what the loop's exits mean.

## Decisions, open

- **Does the loop write back the status it found, on every exit or only on escalation?**
- **Should the stash exclude the backlog file outright** instead? That is a different mechanism
  (a pathspec on the stash) and would decouple the two concerns permanently — but `git stash push -u`
  over the whole tree is deliberate, and narrowing it is a bigger change than it looks.
