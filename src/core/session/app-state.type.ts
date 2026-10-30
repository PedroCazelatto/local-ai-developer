// The shape persisted to ~/.local-ai-developer/state.json (V5/02). HOST-WIDE, not per-project: the
// model is a hardware choice, agnostic to which project is open. Every field is optional so a partial,
// older or empty state.json still loads -- an absent field just falls back to its default.

/** The shape persisted to ~/.local-ai-developer/state.json. Grows over time; keep every field optional. */
export interface AppState {
  /**
   * The model name the user last selected via `/models use` — their explicit choice, so it is the only
   * thing that can boot a session without asking. It is a preference, NOT a guarantee: the blob can be
   * deleted, or the file can be carried to a machine that never pulled it, so boot checks it against
   * the installed set AND against the `tools` capability before honouring it (resolve-boot-model.ts).
   * A missing one is no longer offered for re-pull, and a toolless one is refused.
   * Absent, gone or toolless → boot asks the user to pick; nothing is inferred and nothing is pulled.
   */
  readonly activeModel?: string;
}
