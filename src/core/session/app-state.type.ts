// The shape persisted to ~/.local-ai-developer/state.json (V5/02). HOST-WIDE, not per-project: the
// model is a hardware choice, agnostic to which project is open. Every field is optional so a partial,
// older or empty state.json still loads -- an absent field just falls back to its default.

/** The shape persisted to ~/.local-ai-developer/state.json. Grows over time; keep every field optional. */
export interface AppState {
  /**
   * The model name the user last selected via `/models use` — their explicit choice, so it outranks
   * anything the orchestrator would infer. It is a preference, NOT a guarantee: the blob can be deleted,
   * or the file can be carried to a machine that never pulled it, so boot verifies it against the
   * installed set before honouring it and offers to re-pull it when it's gone (resolve-boot-model.ts).
   * Absent (fresh install / never switched) → boot picks the smallest installed model.
   */
  readonly activeModel?: string;
}
