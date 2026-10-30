# Small unsettled choices around the two model markers

**Category:** Terminal UX

Backlog item 6 shipped two markers — `(no tools)`, which refuses, and `(too heavy)`, which marks
without refusing — across two surfaces, `/models list` and the boot chooser. **Each of the following
was implemented one way because something had to ship, none of them was specified, and every one is a
one-line change.** They are collected rather than filed separately because they are all the same kind
of call and should be decided in one sitting.

| choice | shipped as | the alternative |
|---|---|---|
| **One marker column, `(no tools)` outranks `(too heavy)`** | precedence, measured: both markers on one row makes `/models list` 83 columns and wraps an 80-column terminal | two columns with a shorter spelling (`(heavy)`), which is vaguer and gives a constant a name that does not match its value |
| `/models use` on a `(too heavy)` model | **silent** — it is not a refusal, and nothing specified a note | a one-line "this will run from system RAM" warning |
| The boot chooser's `select` prompt hints | `name` + size only; the markers live in the table printed directly above it | put the marker in the hint too, so the prompt is readable on its own |
| Marker colour | `theme.meta` (dim), matching the chooser's dim rows | `theme.error` / `theme.danger` for `(no tools)`, since it *is* a refusal |
| Declining the boot chooser | **Ctrl+C only** — measured, not assumed: `@clack/core` maps cancel to `\x03` and does **not** map Escape | an explicit `None — start without a model` row in the list |
| A boot with no TTY | declines silently and boots model-less, because `@clack/core` awaits a keypress on a pipe forever | say something first — though there may be no one to say it to |
| A just-pulled toolless model | refused, from a fresh `/api/tags` read after the pull | warn *before* the download, so the user is not offered a deletion after waiting for 9 GB |

## The two worth arguing about

**The last row is the only one with a real cost attached.** `/models use <name>` on an unpulled model
offers to download it, and the capability is genuinely not knowable until the daemon has the blob — so
the refusal cannot honestly move earlier. What *could* move earlier is a caveat: *"if it turns out not
to support tools, it can't be used"*, said before the download rather than after. That is a change to
what the user is told, not to what the code knows.

**The precedence row is the one that is already load-bearing.** It is pinned by a width test, so
widening either marker's spelling fails a test rather than silently wrapping a row — the trap that
already forced `/models list`'s toolless legend from 95 characters to 68. Whoever revisits it inherits
that guard, which is the useful part.

## Why it sits where it does

Every entry is cosmetic or one sentence of copy, nothing depends on any of it, and they are the kind of
choice that is cheap to make together and expensive to make one at a time. Filed because a decision
made silently by an implementer under time pressure is not the same as a decision — and the
alternatives above are the ones that were actually weighed, so this file is the record of what was
considered, not a fresh brainstorm.
