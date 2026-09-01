// Phase ids are lowercase in-code and Titlecased for display, to match the task's `<Phase>` wording.
//
// THIS BODY EXISTS THREE TIMES IN THE REPO, byte-identical down to the doc comment: here, in
// src/interface/commands/clear.ts, and in src/interface/commands/resume.ts. This copy is extracted
// because one function per file required it; the other two are in a directory this wave does not own,
// and a single shared home for all three is a ruling for the sweep rather than something to invent
// here -- see the errMessage/messageOf scar in the sweep brief for what happens when two waves each
// pick one.

/** Phase ids are lowercase in-code; display them Titlecased to match the task's `<Phase>` wording. */
export function titleCase(phase: string): string {
  return phase.charAt(0).toUpperCase() + phase.slice(1);
}
