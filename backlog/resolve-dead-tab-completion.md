# Resolve the dead Tab completion

**Category:** In-app commands

The command registry documents a `complete?(ctx)` hook, four commands implement one — `/run`,
`/answer`, `/models`, `/new-project` — and their comments reason carefully about it ("readBacklog is a
SYNC file read, which is what makes it safe in a completer that must never await", "an async completer
blanks the pinned rows"). All of them point at `src/interface/complete-line.ts`.

That file does not exist. `repl.ts` says plainly: "Completion and the Shift+Tab phase-cycle were
removed." So Tab does nothing, and five sites plus their reasoning assert a feature that is not there.

This is not a cosmetic tidy-up: the comments describe constraints that only make sense if the feature
is live, so the next person to read them is being misled by the code.

Two ways to resolve it, and the choice is the user's:

- **Wire it back.** Restore `complete-line.ts` and hook it into readline's completer. The hard
  constraint is already recorded in the surviving comments — the completer must be synchronous and
  cheap, because it runs on the keypress and an await blanks the pinned status rows. `/run` and
  `/answer` are the two that earn it (task ids are long and easy to mistype).
- **Delete it.** Drop the `complete` field from the `Command` interface, the four implementations, and
  every comment that references `complete-line.ts`.

Either is fine. What is not fine is leaving it as it is.
