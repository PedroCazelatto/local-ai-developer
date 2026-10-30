# Nothing tells the user that a task was marked `failed`, or that a batch skipped one

**Category:** Execution loop / terminal UX

Backlog item 5 made an escalation write `status: failed` into the task's frontmatter and commit it.
The record is durable and the scheduler reads it. **The user is told none of it.**

Three silences, in increasing order of cost:

| what happens | what the user sees |
|---|---|
| an escalation writes and commits `failed` | nothing — the outcome line prints *before* the stash, so it cannot mention it |
| `/run all` passes over a `failed` task | nothing — it is dropped as silently as a `done` one |
| the escalation commit **fails** and the write is rolled back | nothing at all |

The third is the one that matters. `recordFailedAttempt` returns
`{ recorded, sha, error }` and **both call sites discard it** — `route-batch-outcome.ts` and
`run-single-task.ts`. A failure rolls its own write back, so no dirty-tree gate trips and nothing
downstream notices. The task simply stays `pending` and the next `/run all` spends five more rounds on
it: **the exact defect item 5 was built to remove, silently reinstated whenever git has a bad day.**

## Why it was left

Item 5's task file specified the *mechanism* and said nothing about the reporting, and inventing user-
facing strings is not a gap to fill with a default. There is a precedent to follow rather than invent:
`render-task-outcome.ts`'s passing branch already says *"committed … + marked done"*, so *"marked
failed"* is the same sentence in the other direction.

**The obstacle is structural, not verbal.** The two paths cannot say it the same way as things stand:

- `run-single-task.ts` has a renderer and prints its own outcome line — but it prints it *before* the
  stash, and the record cannot move earlier than the stash (that ordering is the whole design).
- `route-batch-outcome.ts` is core orchestration with **no renderer at all**. For the batch to report
  it, the fact has to ride out on the bucket — `BatchEscalated` already carries `stashRef`, so a
  sibling field is the obvious shape.

So this is a small change in two files plus a field on a type, and it needs one decision about where
the batch's line appears.

## Decisions, open — the user's

- **Does the single path print a second line, or does its existing outcome line move after the
  stash?** Moving it is tidier and risks reordering output the user already reads a certain way.
- **Where does the batch report it — per task as it happens, or in the run summary?** The summary
  already enumerates escalations, so it may only need the word `failed` and a note when a record was
  *not* made.
- **Does a rolled-back record deserve a warning rather than a line?** It leaves the backlog lying by
  omission, which is louder than a status change.
- **Does the empty-selection line change?** `No runnable tasks (all done, or blocked by unmet
  dependencies).` is now incomplete — it never mentions `failed`, so a user whose whole backlog failed
  overnight is told everything is done.

## A smaller thing, same area

`failed` renders in `theme.danger`, **shared with `blocked`** — the only role `theme.ts` documents as
"a failing / high-severity outcome". They are told apart by the word alone. That is defensible (they
*are* both failures) and is noted here rather than filed, so that whoever changes these lines decides
it deliberately instead of discovering it.
