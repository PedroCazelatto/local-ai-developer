# The boot VRAM probe costs minutes, cannot be skipped, and pays for models nothing reads

**Category:** Model behavior / boot

Backlog item 6 shipped the probe that measures VRAM residency by **loading each installed model once**
and reading `/api/ps`. That is the only honest way to get the number — Ollama exposes no capacity
query, and `size_vram < size` is only knowable after a load. The measurement is cached forever, keyed
on `(digest, num_ctx)`, so the cost is paid once per model per ceiling.

**Once is still minutes, and three separate things make that worse than it needs to be.**

| | cost here |
|---|---|
| nine installed models at 10–30 s each | **~2.7 minutes on a first boot** |
| three of those nine report no `tools` | ~54 s measuring models the product can never run |
| a boot with a usable saved `activeModel` prints no list at all | the whole cost is paid for markers the user does not see until they type `/models list` |
| no env var, no flag, no skip | the user cannot decline it |

## Why each one is a real question rather than an obvious fix

**Probing toolless models is provably pure cost.** `(no tools)` outranks `(too heavy)` in the single
marker column, so a toolless model's measurement is *never rendered on any surface*. The task file
said "each installed model" and the implementer followed it rather than narrowing on its own
judgement, which was right — but the words were written before the precedence decision existed, so
they cannot have meant to include this case.

**The bigger one is subtler.** The probe can only run at boot, because probing *is* loading and a
probe during a live session would evict the session's model mid-turn — the one thing the
no-parallelism rule exists to prevent. So there is no lazy alternative: it is boot or never. That
means the cost cannot be deferred to the moment the user actually asks for a list, and a user who
never types `/models list` pays it for nothing.

**No opt-out was specified**, and adding one is not free either: a skipped probe means an empty cache,
which renders no `(too heavy)` marker at all — indistinguishable, on screen, from a machine where
every model fits.

## Decisions, open — all the user's

- **Does the probe measure only the tool-capable subset?** Saves ~54 s here and loses nothing that is
  currently rendered. The counter-argument is that the capability gate could change, and a cache keyed
  on digest keeps rows forever, so measuring everything now means never re-measuring.
- **Does a first boot probe at all, or only when something will show the result?** A third option
  exists and may be the best of the three: probe **lazily on the first `/models list`**, accepting that
  the list is then slow once. That contradicts nothing about the mid-session rule *if* the list is only
  reachable between turns — which needs checking rather than assuming.
- **Is there an opt-out, and what does a skipped probe render?** If the answer is a flag, the second
  half is the part that needs deciding.
- **Is ~2.7 minutes on a first boot acceptable at all?** It may simply be fine — it happens once, and
  the alternative is a wrong answer about the machine. Saying so deliberately closes this item.

## Why it sits where it does

Nothing is broken and the measurement is correct; this is entirely about **cost the user did not
choose**. It is filed rather than fixed because every option above trades boot time against how much
the product knows about the machine, and that trade is the user's to make. Related:
[items 33](failed-record-is-invisible-to-the-user.md) and
[38](marker-and-prompt-choices-left-open.md).
