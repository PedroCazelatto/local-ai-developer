# Half the tools name themselves with a constant, half with a literal

**Category:** Repo hygiene

Every one of the 23 model-facing tools in [src/tools/](../src/tools/) has the same shape —
`{ name, description, parameters, execute(…) {…} }`, `execute` as method shorthand, verified by parser
across all 23. **They disagree on one thing: how `name` is spelled.**

| form | count | example |
|---|---:|---|
| exported constant | 11 | `export const ASK_USER = 'ask_user'` then `name: ASK_USER` |
| inline string literal | 12 | `name: 'read_file'` |

The split is not arbitrary, which is what makes it a question rather than a typo. **The eleven constants
exist because something outside the tool needed the name as a symbol**, and they are genuinely used:

- `core/session/worker-window.ts:47` keys a per-tool record on `[COMMIT_CHANGES]`
- `core/session/reviewer-window.ts:188` compares `name === COMMIT_CHANGES` at runtime
- `core/session/build-reviewer-seed.ts:43` interpolates `${LIST_CHANGES}` and `${COMMIT_CHANGES}` into a
  prompt the model reads
- `core/session/subagents.ts:37` builds `SUBAGENT_TOOL_NAMES` from `SPAWN_SUBAGENT`, `ASK_SUBAGENT` and
  `DISMISS_SUBAGENT`

The twelve literals are simply the tools nobody has yet needed to reference by symbol. So the current
state is what you get from adding a constant the first time each name is needed elsewhere, and never
going back.

## Why it is worth a decision

**The user's ruling on tool shape was explicit that all tools must be in the same format**, and this is
the one axis on which they are not. It is also the axis where being inconsistent has a real cost, because
there are already **two competing conventions for naming a tool from outside**:

- `src/phases/phase-tool-names.ts` — the per-phase allowlists — spells **every** tool name as a string
  literal, including the six phase-scoped ones (`'submit_verdict'`, `'raise_blocker'`, …).
- `src/core/session/*` — the runtime comparisons and prompt builders above — **imports the constant.**

Both are defensible and the repo does both. `phase-tool-names.ts` can afford literals because
`resolve-phase-tools.ts` **fails loud on a name no tool answers to**, so a typo there cannot silently drop
a tool from a phase. Nothing gives the `core/session` comparison sites that guarantee — a typo in
`name === COMMIT_CHANGES` would be a compile error, but a typo in `name === 'commit_chnages'` would
simply never match, and **a tool that silently never matches is invisible at runtime**: the model calls
it, the branch does not fire, and nothing reports anything.

That asymmetry is the actual argument, and it points one way: **the constant is the safer form precisely
where a literal is unchecked.**

## Open decisions — all of them the user's

- **Do all 23 tools export a name constant, or only those with an outside consumer?** Uniformity says
  all 23; minimalism says a constant with no importer is ceremony. Note that "only when needed" is what
  produced today's split, so choosing it means accepting the split as correct rather than accidental.
- **Where does the constant live?** Today each is declared in its own tool file and re-exported by
  `src/tools/index.ts` — which **wave E deletes**, so its five re-export lines for tool-name constants
  have to land somewhere regardless. A single `tool-names.ts` would collide conceptually with
  `phase-tool-names.ts`; leaving them in the tool files keeps the name beside the tool it names.
- **Does `phase-tool-names.ts` switch to the constants?** It is `DATA ONLY` by its own header and reads
  well as a flat list of strings. Importing 23 constants into it would make it a wall of identifiers for
  a file whose whole purpose is to be readable at a glance — and its fail-loud check already covers the
  typo risk. Probably leave it, but say so deliberately.
- **Do the six phase-scoped names get constants too?** They are deliberately absent from the global
  registry and only ever named in `phase-tool-names.ts` and the intercepting window's own `callTool`.

## Why it sits where it does

Small, pure hygiene, and nothing depends on it. It is filed rather than folded into backlog item 1's
sweep on purpose: item 1's `src/tools` wave was a no-behaviour-change refactor that took the directory
from 24 files / 74 declarations to zero, and adding twelve new exported constants inside it would have
buried an API change in a mechanical diff. **The sweep made this visible; it did not cause it.** The
proof is that the 11/12 split predates the sweep — the constants were already there, in the same files,
for the same consumers.

It should ship **after** wave E, because the barrel deletion decides where a tool-name constant is
imported from and there is no sense answering that question twice.
