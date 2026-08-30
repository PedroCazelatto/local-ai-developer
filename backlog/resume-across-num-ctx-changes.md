# `/resume` hides contexts written under a different ceiling

**Category:** Memory / context

`insertContext` stamps every phase context with the `num_ctx` it was written under, and both
`listContexts` and `resolveContextId` (`src/core/session/memory-db.ts`) filter on **`num_ctx = ?`** —
strict equality.

So anyone who has ever changed `OLLAMA_NUM_CTX` has unreachable history right now. Nothing is deleted
and nothing is listed; restoring the old value brings it all back. Silently, in every project.

## Why this is a defect on its own, not a migration step

It was found while asking what would happen to existing contexts *if* the global ceiling moved
([tune-the-global-num-ctx-default.md](tune-the-global-num-ctx-default.md), OPEN-QUESTIONS.md #35). The
ceiling then stayed at 16 384 (#68b), so nothing needs migrating — and this remains broken regardless,
which is why #36 answered **"yes, ship it as its own fix."**

The asymmetry is what makes the fix correct rather than convenient: **a context built for a smaller
window replays safely into a larger one; the reverse does not.** A history that fitted 8 192 fits
16 384. A history that filled 16 384 does not fit 8 192, and restoring it there means Ollama silently
drops its front.

## The shape of a fix

Relax the predicate from `num_ctx = ?` to **`num_ctx <= ?`** in `listContexts` and `resolveContextId`,
and warn in `/resume` when the context being restored was written under a *different* (smaller)
ceiling, so the user is told rather than left to infer it from a shorter history.

Contexts written under a **larger** ceiling stay hidden, and that is the point — they are the ones that
cannot replay safely.

## Not to be confused with

The `num_ctx` stamp itself, which stays exactly as it is. `resolve-window-ctx.ts` is built so that no
derived ceiling can reach the persistence path (`memory.ts` takes the raw env value and never imports
the resolver). This task changes only the **read** predicate; what gets written is untouched.

## Open decisions

- **Does the warning name the old ceiling, or just say the history is from a smaller window?** Naming
  it is more useful and also invites the user to set it back, which is not what the fix is for.
- **Does `/resume`'s listing mark the mismatched contexts, or only warn on the one being restored?** The
  listing is where the user chooses, so marking there is arguably where it belongs.
