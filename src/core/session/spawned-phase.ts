// The phase a SPAWNED window's context is recorded under in memory.db — the one place that spelling is
// made (backlog item 9, OPEN-QUESTIONS.md #101b).
//
// A spawned window (Worker, Reviewer, Retro, sub-agent, the three debate windows) writes its trace into
// the same `contexts` + `messages` tables an interactive phase does (#97), so its rows need a phase
// that `/resume` can never mistake for a resumable one. `/swap` accepts every file in rules/phases/ —
// `worker`, `reviewer` and `retro` included — so a spawned Worker writing `phase = 'worker'` would put
// its rows in front of `/resume` as though a person had held that conversation. A colon can never
// appear in a phase name that came from a filename, so `worker:spawned` is unforgeable, and `/resume`'s
// existing `phase = ?` filter excludes every spawned row by construction: no column, no migration, and
// no predicate to remember to update.
//
// The record name and the prompt name come apart here and only here: a spawned Worker still loads
// rules/phases/worker.md, from its plain base name, and records under this function's result.

/** `<base>:spawned` — e.g. `worker` → `worker:spawned`. */
export function spawnedPhase(base: string): string {
  return `${base}:spawned`;
}
