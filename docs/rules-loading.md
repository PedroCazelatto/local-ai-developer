# Rules loading

Rules are all Markdown, under [rules/](../rules/), and are **global** — projects are agnostic to the
orchestrator and do not override rules. These files are what the *local Ollama model* reads; they are
not Claude Code's instructions.

Three folders:

- **Phases** ([rules/phases/](../rules/phases/)) — the phase instruction sets, injected automatically
  when a phase is loaded. A file holds the phase definition *and* the workflow it owns. The set is
  closed at six files:
  [discovery.md](../rules/phases/discovery.md) ·
  [design.md](../rules/phases/design.md) ·
  [breakdown.md](../rules/phases/breakdown.md) ·
  [worker.md](../rules/phases/worker.md) ·
  [reviewer.md](../rules/phases/reviewer.md) ·
  [retro.md](../rules/phases/retro.md)
- **Standards** ([rules/standards/](../rules/standards/)) — on-demand reference rules, loaded via tool
  call. This folder is intended to grow freely; do not maintain a copy of its listing anywhere else.
- **Prompts** ([rules/prompts/](../rules/prompts/)) — the instructions the **orchestrator** injects into
  a throwaway one-shot context, read by `loadPrompt`
  ([src/context/load-prompt.ts](../src/context/load-prompt.ts)) and **deliberately not part of the
  standards catalog.** The distinction is direction: a standards file is something the model may *choose*
  to read, while these are written to be used *on* it, so offering one to `search_rules` would be
  offering the model the prompt that describes it.
  The folder so far:
  [context-title.md](../rules/prompts/context-title.md) — the rules for titling a phase context (see
  [mental-model.md](mental-model.md)) — plus the three that make up one deliberation loop,
  [debate-challenger.md](../rules/prompts/debate-challenger.md),
  [debate-proponent.md](../rules/prompts/debate-proponent.md) and
  [debate-digest.md](../rules/prompts/debate-digest.md) (see [phases.md](phases.md)). A debate is the
  clearest case for the rule above: the challenger prompt is written to attack whatever the model just
  decided, so a model that could read it first would be reading the brief for its own cross-examination.

## What a phase can call

Each phase has one array of tool names in
[src/phases/phase-tool-names.ts](../src/phases/phase-tool-names.ts), and `resolvePhaseTools` turns
that array into the tool definitions its window sends to Ollama. **The array is the gate:** a tool it
does not name is a tool that phase never sees. An unknown phase, or a name no tool answers to, throws
— a typo cannot quietly shrink a phase's surface, which would otherwise be invisible at runtime.

The phase markdown does **not** list those tools. `buildToolSection` renders the same array the
window sends into a `# Your Tools` block in the system prompt, so the advertised list and the real
surface are one thing and cannot disagree. Hand-written inventories in the phase files drifted three
times before this: a phase file's job is to say *when* to reach for a tool, never *whether* it
exists. The block costs roughly 100–200 tokens per turn — that is the price of the guarantee.

The planning phases (Discovery/Design/Breakdown) get no shell: `execute_command` and `run_in_project`
are absent from their arrays, because planning writes documents and `read_file`/`list_files`/
`search_in_files` already cover inspection.

## Retrieval: LLM-delegated search

To keep the main context lean, the standards catalog is **not** in the system prompt. Two tools:

1. `search_rules(intent)` — the model describes what it needs. The orchestrator spawns a **fresh,
   throwaway LLM context** (never added to session memory) that receives the full `{name,
   description}` catalog plus the intent, and returns the matching rule name(s). The main context
   never sees the catalog.
2. `load_rule(name)` — returns the full markdown of the named rule. The model calls this after
   `search_rules` resolves.

This splits the cost: search-time context holds the catalog once per call and is discarded; the main
context only holds the file the model actually chose to load.
