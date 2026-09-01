// The typed failure phase-tool gating raises: an unknown phase name, or an array naming a tool no
// module answers to. It is a distinct error class so a caller can tell "the tool arrays are wrong"
// from any other throw — resolve-phase-tools.ts fails loud on both, because a dropped tool is
// invisible at runtime (the model simply never sees it and works around the gap).
//
// Its own file because a class is a declaration like any other, and resolvePhaseTools is the second.

/** Typed failure so a caller can tell a bad phase/tool name from any other error. */
export class PhaseToolsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PhaseToolsError';
  }
}
