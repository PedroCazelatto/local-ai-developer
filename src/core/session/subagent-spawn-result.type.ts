// What spawn_subagent gets back — one unowned type, in its own file. It is named twice: by
// SubagentHandle.spawn (a method on an interface, which owns nothing) and by SubagentManager.spawn,
// which implements that method. Folding it into subagents.ts would make subagent-handle.type.ts import
// the manager module for its own vocabulary, and src/tools reach the manager transitively — the exact
// coupling the contract exists to prevent. See subagent-handle.type.ts.

/** spawn_subagent's result: the new id + the sub-agent's first answer, in one round-trip. */
export interface SubagentSpawnResult {
  readonly id: string;
  readonly response: string;
}
