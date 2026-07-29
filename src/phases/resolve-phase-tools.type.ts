// Options for resolvePhaseTools (sibling type file — constitution: types never inline with a function).

export interface ResolvePhaseToolsOptions {
  /**
   * Drop the phase-scoped tools, keeping only what the GLOBAL registry can serve. Set this when the
   * caller routes tool calls through the shared dispatcher (dispatch.ts → getTool), which knows the
   * registry and nothing else: offering `submit_verdict` to a window that dispatches that way would
   * hand the model a tool whose only possible answer is "unknown tool". The spawned Worker/Reviewer/
   * Retro windows intercept their own phase-scoped tools in `callTool`, so they leave this unset.
   */
  readonly registryOnly?: boolean;
}
