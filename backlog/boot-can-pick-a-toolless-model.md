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

Filter the pick on the `tools` capability Ollama reports, and keep "smallest" as the tie-break among
the models that qualify. `listModels` currently projects the capability away before `pickSmallestModel`
can see it, so `InstalledModel` grows the field first. There are **four call sites, not one** — the
saved-model branch, the re-pull branch, the pick rule, and `/models use`.

## Decisions (answered — OPEN-QUESTIONS.md #1, #7–#14)

- **No tool-capable model installed → boot model-less** (#7). The REPL still comes up, the status line
  reads `no model`, and each turn fails with an actionable line — the machinery already works end to
  end, and it is the only outcome that leaves `/models pull` reachable.
- **The failure line names no model** (#8): "pull a model with tool support". `SUGGESTED_MODEL` is a
  suggestion for an *empty* machine, and it has not itself been verified as tool-capable.
- **A saved `activeModel` that is toolless is refused**, and boot falls through to the pick rule (#9).
  The same for a saved-but-missing model offered for re-pull (#10) — capabilities are unknowable until
  the blob is on disk, so the gate runs *after* the pull — the reading confirmed at **#71**.
- **Nothing is pulled without approval** (#1). Boot's precedence is otherwise unchanged: a usable saved
  model wins; an empty machine gets a suggestion, never a silent download.
- **An absent `capabilities` field fails closed** (#13) — assume incapable. A pre-`capabilities` Ollama
  daemon therefore boots model-less on a machine full of models; the recovery is one `/models use`.
- **`/models list` marks tool support** (#14) — the list is where "why was that one skipped" is asked.
- **The warning lives in the pinned status line**, `Model: <name> (no tools)` (#12). Boot scrollback is
  wiped by the REPL's one-time `clearScreen`.
- **`/models use <name>` on a toolless model takes a single-keypress confirm, then switches** (#11c).

## Still open

- **#69 (was #11 vs #7) — confirm, or refuse?** #7's answer says `/models use` should *refuse* a toolless model;
  #11 answers `c`, a single-keypress confirm that then switches. Both cannot hold. The doc and the list
  above follow **#11c**, because #12's `(no tools)` status marker only has a reason to exist if a
  toolless model can become active. **Confirm before building it.**
- **Is the capability cached or re-read?** (not numbered — not asked in the first pass) `/api/tags` is cheap, but the boot path already has a reason
  to be fast, and a per-model `/api/show` at boot would be N round-trips rather than one.
- **#72 — a minimum Ollama version now has to be stated somewhere.** Fail-closed (#13) turns "your daemon is
  too old to report capabilities" into "no model can run this product", and the repo currently declares
  no floor at all. This box runs 0.32.9, which reports it.
