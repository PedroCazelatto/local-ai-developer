// What ask_subagent gets back — one unowned type, in its own file for the same reason as
// subagent-spawn-result.type.ts: it is the return type of SubagentHandle.ask, a method on an interface,
// which owns nothing, and of SubagentManager.ask, which implements it. Keeping it here is what lets
// subagent-handle.type.ts stay free of any import from subagents.ts.

/**
 * ask_subagent's outcome: `found` carries the answer; `!found` lets the tool build the recoverable
 * `unknown_subagent` error (the id was dismissed or never existed) — the turn is never killed.
 */
export type SubagentAskOutcome =
  | { readonly found: true; readonly response: string }
  | { readonly found: false };
