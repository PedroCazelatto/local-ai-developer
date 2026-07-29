# Give the planning phases their missing tools

**Category:** Model behavior / instructions

Discovery, Design, and Breakdown declare a tool surface far narrower than the one the orchestrator
actually hands them. Seven registered tools are unreachable to those phases in practice — not because
the code gates them, but because their own instruction files tell them the tools do not exist.

## The mismatch

`SessionOrchestrator` builds the full registry once and sends it on every call, and its own comment
says so: *"Interactive phases still get the full `tools`"* (`src/core/session/orchestrator.ts:70`).
Filtering happens only in the spawned execution windows — Worker drops `commit_changes`, Reviewer runs
a read-mostly allowlist, Retro is cut to a project read/edit subset. **No filter ever applies to the
planning phases.** Yet:

- [discovery.md](../rules/phases/discovery.md) line 32 — "On-demand standards retrieval
  (`search_rules`/`load_rule`) is a later addition — **do not call it; it does not exist yet.**"
- [design.md](../rules/phases/design.md) lines 9 and 28 — the same sentence, plus "Nothing else is
  callable yet."
- [breakdown.md](../rules/phases/breakdown.md) line 68 — "Nothing else is callable yet."

The text is stale, not conservative: it was written in `edc8024` (2026-07-10) and `search_rules` /
`load_rule` shipped the next day in `d95b0e0`. The three files have been edited several times since
without the claim being revisited.

## What is missing from all three lists

- **`search_rules` / `load_rule`** — shipped, globally registered, explicitly forbidden by the text.
- **`spawn_subagent` / `ask_subagent` / `dismiss_subagent`** — [registry.ts](../src/tools/registry.ts)
  registers these globally with the comment "so the interactive phases advertise them." **No phase file
  mentions them at all**, so the phases they were registered for are the only ones that can call them
  and the only ones never told they exist.
- **`execute_command` / `run_in_project`** — registered globally, named in no phase file either. Worker
  is told to run everything inside Docker but is never given the tool name.

## Why it matters now

The [simplified-technical-english](../rules/standards/simplified_technical_english.md) standard was
built around this gap. Worker, Reviewer, and Retro get a two-line reminder that points at
`load_rule("simplified-technical-english")` and costs 65–88 tokens per turn. Discovery, Design, and
Breakdown cannot point anywhere, so their reminders inline the rules and cost 116–129 tokens per turn
— and still deliver less, because the phases writing `PRODUCT_SPEC.md` and the backlog task files can
never read the full standard they are being held to.

Fixing the tool lists makes the follow-on cleanup trivial: swap the three self-contained bullets for
the pointer form and each planning phase gets the whole standard on demand while paying about 50 fewer
tokens on every turn.

## Still open

- **Should the planning phases run commands at all?** `execute_command` and `run_in_project` are
  reachable from Discovery today. If the answer is no, this stops being a text fix and needs a real
  filter in the orchestrator — the phase markdown is steering, not enforcement, and a model that
  decides to run a build during an interview is not prevented by prose.
- **Should these lists exist?** A hand-maintained tool inventory duplicated across six phase files has
  now drifted twice. Either generate the section from the registry, or drop the inventories and let
  each phase file name only the tools its workflow actually leans on.
