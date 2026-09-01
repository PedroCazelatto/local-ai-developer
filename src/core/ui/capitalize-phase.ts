// The one home for "show this phase name to a human" — the identical body is declared privately in
// three more files today: core/session/orchestrator.ts, interface/commands/clear.ts and
// interface/commands/resume.ts. All four format a phase name for DISPLAY — a status row, a transition
// line, a confirmation — and that concern is what puts it here beside write.ts rather than in
// src/phases/, which holds phase definitions, or at the root of core/, which would start becoming the
// drawer everything cross-cutting lands in.
//
// The one-function-per-file sweep repoints each copy here as it reaches that copy's directory, and a
// file still declaring its own has simply not been swept yet. The three above are NOT this wave's to
// change: orchestrator.ts belongs to the live core/session sweep and the two under interface/commands/
// belong to wave D. Each replaces its own copy when it gets there.

/** Capitalize the first letter for display (discovery → Discovery). */
export function capitalizePhase(phase: string): string {
  return phase.charAt(0).toUpperCase() + phase.slice(1);
}
