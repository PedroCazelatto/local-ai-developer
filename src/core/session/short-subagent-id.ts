// The SHORT form of a sub-agent id — the `[sub:01JQ]` marker on its tool-call lines, the `/subagents`
// listing, and the answer line its spawn call leaves behind.
//
// Its own file because three layers need it and one of them is a tool: spawn_subagent reports which
// sub-agent answered, and importing that from subagents.ts would close a cycle (SubagentManager
// imports SPAWN_SUBAGENT from the tool). The same shape as memory-db's shortContextId — a length and
// the function that applies it, so the two can never disagree.
//
// Four characters is enough to tell a session's sub-agents apart because the id is time-prefixed
// (generate-subagent-id.ts): the short form increases with creation order rather than being random.

/** How many leading characters of a sub-agent id the short form shows. */
export const SUBAGENT_SHORT_ID_LEN = 4;

/** The short, human-facing form of a sub-agent id. */
export function shortSubagentId(id: string): string {
  return id.slice(0, SUBAGENT_SHORT_ID_LEN);
}
