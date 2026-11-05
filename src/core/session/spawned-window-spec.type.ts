// What a caller says about the spawned window it is opening, to get that window its trace and its
// failsafe (spawned-memory.ts). Its own module because the CALLER builds it — the task loop, Retro, the
// sub-agent manager and the debate tool each describe their own window — and the class only consumes it
// (constitution, "A dependency seam is not owned by the function that consumes it").

/** One spawned window, as its opener describes it. */
export interface SpawnedWindowSpec {
  /**
   * The window's own phase name — `worker`, `reviewer`, `retro`, `subagent`, `debate-challenger`,
   * `debate-proponent` or `debate-digest`. Recorded as `<base>:spawned` (spawned-phase.ts).
   */
  readonly base: string;
  /** The context's title, written by the orchestrator: which task, sub-agent or claim the window served. */
  readonly title: string;
  /** How the failsafe's one status line names the window, e.g. `Worker` or `Sub-agent 3f2a`. */
  readonly label: string;
  /**
   * SUMMARIZATION_THRESHOLD_RATIO, or null for a window too short ever to need the failsafe — the debate
   * digest, which makes one or two calls. Null still records the window; it only never compacts it.
   */
  readonly summarizationThresholdRatio: number | null;
  /**
   * The `phase` a `summarization_fire` row carries — the name the events log already uses for this
   * window: `worker` / `reviewer` / `retro`, the MASTER phase for a sub-agent, the calling phase for a
   * debate window.
   */
  readonly eventPhase: string;
  /** A sub-agent's id, carried on its event rows so two sub-agents' compactions stay apart (#27a). */
  readonly subagentId?: string;
  /** Extra `detail` on the event row — a debate window's `window: challenger | proponent`. */
  readonly eventDetail?: Readonly<Record<string, string>>;
}
