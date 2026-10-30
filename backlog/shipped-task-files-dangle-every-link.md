# Deleting a shipped task file dangles every link to it — 26 sites and counting

**Category:** Repo hygiene / process

The backlog convention is that finishing a task **deletes its file**, and the deletion commit is the
record that the work landed ([docs/repo-layout.md](../docs/repo-layout.md)). That is a good convention.
It has a cost nobody had measured: **every cross-reference to that file breaks, silently.**

Scripted over `backlog/*.md` — every relative `.md` link checked against the tree:

| dead target | sites | shipped as |
|---|---:|---|
| `record-attempted-tasks.md` | 11 | item 5 |
| `boot-can-pick-a-toolless-model.md` | 5 | item 6 |
| `evict-stale-tool-results.md` | 4 | an earlier foundation item |
| `resolve-dead-tab-completion.md` | 2 | " |
| `show-tool-calls-in-the-scrollback.md` | 2 | " |
| `inspection-commands.md` | 1 | " |
| `node-version-is-not-enforced.md` | 1 | item 3 |
| **total** | **26** | across 7 targets |

**Nothing will ever surface these.** They are Markdown links in prose — no compiler, no test, no lint.
The same blind spot as [item 29](prose-names-files-the-sweep-deleted.md), one level up: that item is
about comments naming deleted *source* files, this is about docs naming deleted *task* files.

## The cost is not evenly spread, and one shape of it is worse

Most are a reader's dead end. But several are **load-bearing cross-task reasoning** — the sentences
that say why one item must precede another. `README.md:365` and `:384` use item 5 to explain item 2's
ordering; `README.md:1210` points at item 6 as "where the tag is decided". A dead link there does not
merely inconvenience a reader, it **removes the argument** for a sequencing decision that the ledger
elsewhere insists must not be reordered without going back to the file that states it.

## There is a mechanical fix, which is why this is worth doing rather than tolerating

**The ledger never deletes a shipped item's entry — it strikes it and keeps the number**, because
"numbers are never reused and never renumbered". So every dead target has a live, stable successor:
its struck heading in [README.md](README.md). The repoint is therefore one substitution **per target**,
not 26 judgements:

```
[item 5](record-attempted-tasks.md)  →  [item 5](README.md#5-stop-a-failed-task-looking-untouched--shipped)
```

That is seven edits covering 26 sites, and it ages well: the anchor survives as long as the ledger
does.

## Decisions, open

- **Anchor link, or plain text?** An anchor keeps the reference navigable; plain **`item 5`** never
  breaks again but makes the reader search. The anchor depends on the exact struck heading text, which
  is a thing that gets reworded — so the durable-looking option is the fragile one.
- **Does the convention itself gain a step?** *"Before deleting a task file, repoint links to it"* is
  one line in `docs/repo-layout.md` and prevents recurrence. Without it this item is a sweep that runs
  again after every shipped task — five of the 26 sites were created **today**, which is the argument
  that a one-off cleanup is not the fix.
- **Should a check enforce it?** A pure function over `backlog/*.md` would catch dead links the day
  they appear, and it is genuinely cheap. It is also the second such check being proposed —
  see [item 36](naming-half-of-one-function-per-file-unmeasured.md) — so the real question is whether
  this repo wants a small "docs integrity" test file at all.

## Why it sits where it does

Mechanical, safe, and it protects reasoning the ledger says must not be lost. It is filed rather than
done in passing because the process half — the extra convention step — is the part that stops it
recurring, and that is the user's call rather than a cleanup.
