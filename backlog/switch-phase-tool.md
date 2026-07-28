# Give the model a switch_phase tool

**Category:** Model behavior / instructions

The model must never be handed the in-app slash-commands themselves. It gets **tools that do the same
job with guardrails** — `switch_phase` is the first of them, standing in for `/swap`.

`switch_phase` does more than change the active phase. It *starts* the target phase with:

- its **base context** — the phase instruction set, as any phase load does;
- a **starter message** written by the calling phase, so the new phase knows where it must go; and
- either a **fresh context** or an **existing phase context** chosen by the caller.

The outgoing phase reads the list of available phase contexts and decides for itself whether to open a
fresh one or resume an old one. That decision is only as good as the context titles, which is why this
task **depends on [phase-context-history.md](phase-context-history.md)** — build that first.

Decided:

- The started phase **runs immediately** on the starter message; the handoff is autonomous rather than
  returning to the prompt for the user to drive.
- **No cap on chained switches** — a started phase may call `switch_phase` again, and the chain runs
  until the model stops calling the tool.

## Implementation hazard

Applying the switch *during* the tool call splits one turn across two phase histories.
`SessionOrchestrator.callTool` runs while a turn is in flight, so the assistant message carrying the
`tool_calls` is written to the outgoing phase while `addToolResult` writes the matching `tool` result
to whichever phase memory is active when the call returns. A `tool` message with no preceding
`tool_calls` message breaks the chat template on replay. The switch must therefore be recorded and
applied at a point where the pair stays in one history — not inside the tool's `execute`.
