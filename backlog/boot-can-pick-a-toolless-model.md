# Boot can pick a model that cannot call tools

**Category:** Model behavior

`pickSmallestModel` chooses the boot model by sorting the installed set on disk bytes and taking the
smallest. It does not look at what the model can *do*.

On this machine, with no `~/.local-ai-developer/state.json`, that pick lands on
**`deepseek-coder-v2:16b`**, whose `/api/tags` capabilities are `completion,insert` — **no `tools`**.
Every phase in this product is a tool-calling loop: a Worker that cannot call `edit_file` cannot do
anything at all. So the unattended path — no saved state, no model named at boot, which is exactly the
first-run path — can select a model that is structurally incapable of running the product, and nothing
says so until the model fails to emit a tool call and the phase burns its rounds looking confused.

`resolveBootModel` already treats the installed set as the only ground truth, which is the right rule;
the set it filters is simply not filtered enough.

## The shape of a fix

Filter the boot pick on the `tools` capability, which `/api/tags` already reports, and keep "smallest"
as the tie-break among the models that qualify. The interesting part is the failure path, not the happy
one.

## Open decisions

- **What happens when no installed model has `tools`.** Refuse to boot with a line naming the problem
  and what to pull, or boot anyway and warn? Refusing is honest; booting keeps `/models` reachable so
  the user can fix it from inside the app, which argues for booting with a loud, pinned warning.
- **Does `/models use <name>` get the same check?** A deliberate choice is not the same as a default,
  so this may want a warning rather than a refusal — but a user who picks a toolless model by hand has
  the identical broken session.
- **Is the capability cached or re-read?** `/api/tags` is cheap, but the boot path already has a
  reason to be fast.
- **Does this want a doc line?** `docs/cli.md`'s *Model selection* section describes the boot pick as
  "the smallest installed model", which becomes wrong the moment it is filtered.
