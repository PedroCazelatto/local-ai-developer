// Types for the orchestrator-GLOBAL app state (V5/02) — sibling of app-state.ts (constitution:
// types live beside the function they serve). This is host-wide, home-dir state, NOT per-project
// session state (config.ts): the model is the user's hardware choice, agnostic to which project is
// open, so it must never live under projects/<name>/.orchestrator/. Every field is optional so a
// partial/older/empty state.json still loads — an absent field just falls back to its default.

/** The shape persisted to ~/.local-ai-developer/state.json. Grows over time; keep every field optional. */
export interface AppState {
  /**
   * The model name the user last selected via `/models use`. Read at boot AFTER DEFAULT_MODEL so the
   * next `run start` defaults to it; absent (fresh install / never switched) → DEFAULT_MODEL fallback.
   */
  readonly activeModel?: string;
}
