// Which `num_ctx` ceiling ONE model call is sent under, resolved from the role it plays. This is the
// one place that decision is made — client.ts puts the returned number on the wire and reads no field
// of its own for it.
//
// THE TABLE HOLDS ONLY THE ROLES THAT DIFFER FROM THE BASE. Every window role — interactive, worker,
// reviewer, retro, subagent — plus `summarize` and both debate roles resolve to OLLAMA_NUM_CTX by
// having no entry at all. That is the first of two mechanisms making the base ceiling structurally
// exact rather than exact by convention, and the reason matters: `contexts.num_ctx` stamps the value
// every phase context was written under and every `/resume` listing filters on it, so a derived value
// reaching it would remove every context in every project from `/resume` — silently, since nothing is
// deleted and nothing is reachable. Getting a wrong number to those roles requires ADDING an entry
// here, never editing one.
//
// The second mechanism is that the persistence path cannot reach this file. SessionMemory takes
// `config.numCtx` — the raw env value — and core/session/memory.ts does not import this module. That
// is why there is no runtime guard below: the failure it would catch is unreachable by construction,
// and a guard would imply otherwise.
//
// `CallRole` is closed, so a mistyped role is a compile error rather than a silent fall-through to the
// base — the fail-loud property resolve-phase-tools.ts gets from a throw, taken here from the type
// system instead, because this resolves per call rather than once per phase.

import type { CallRole } from './call-role.type.js';

/**
 * The ceiling for the BOUNDED one-shots — the three whose input has a known hard maximum.
 *
 * 8 192 buys RESIDENCY, not tokens. Measured on the RTX 3060 12 GB with `qwen2.5-coder:14b`
 * (`size_vram` / `size` from Ollama's `/api/ps`): at 8 192 the model is fully resident at 10.28 GB,
 * while at 16 384 it runs with 1.93 GB offloaded to the CPU. So a bounded one-shot runs entirely on
 * the GPU even while the session's windows do not.
 *
 * It is a deliberate trade with a known cost, not a free saving: changing `num_ctx` makes Ollama
 * rebuild the runner — ~90 ms when the ceiling is unchanged, ~3.3 s when it changes — so each of these
 * calls pays roughly 6.6 s of rebuild, going down and coming back. A turn that fires none of them pays
 * nothing, which is why the roles that would fire mid-turn constantly are not in this group.
 *
 * 4 096 was rejected as too tight: the commit-message writer's worst case is 3 298 prompt tokens, at
 * REVIEW_DIFF_BUDGET's 12 000-character diff.
 */
const BOUNDED_ONE_SHOT_NUM_CTX = 8192;

/**
 * Role → ceiling, for the roles that differ from the base ONLY (see the header). Three entries, all
 * the same number, listed separately rather than collapsed so that moving one role out of the bounded
 * group is a one-line edit with nothing else to reason about.
 *
 * `summarize` is deliberately absent: its input is the oldest ~50% of a history that has just crossed
 * SUMMARIZATION_THRESHOLD_RATIO of the ceiling — ≈6 100 tokens at 16 384 — so a smaller ceiling would
 * make Ollama silently drop the front of the slice, corrupting exactly what the failsafe protects.
 *
 * Both debate roles are deliberately absent too: `debate`'s `background` is free text the MODEL writes
 * and nothing caps it (backlog/cap-the-debate-background-parameter.md), and an uncapped input under a
 * reduced ceiling is silent truncation. Capping it is what would let those two join this group.
 */
const CEILING_BY_ROLE: Partial<Record<CallRole, number>> = {
  'context-title': BOUNDED_ONE_SHOT_NUM_CTX,
  'search-rules': BOUNDED_ONE_SHOT_NUM_CTX,
  'commit-message': BOUNDED_ONE_SHOT_NUM_CTX,
};

/**
 * The exact `num_ctx` for a call playing `role`, given the session's base ceiling (OLLAMA_NUM_CTX).
 * A role with no table entry gets the base unchanged — which is every window role, and is what pins
 * the persisted ceiling to the env value by construction.
 */
export function resolveWindowCtx(role: CallRole, baseNumCtx: number): number {
  return CEILING_BY_ROLE[role] ?? baseNumCtx;
}
