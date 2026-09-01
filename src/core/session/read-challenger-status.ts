// Split the challenger's mandatory `STATUS:` line off its prose.
//
// A reply with NO status line is read as STILL OBJECTING, and that default is the safe direction: a
// concession ends the debate early, so it must be stated explicitly and never inferred from a model
// that forgot the format.
//
// Named readChallengerStatus rather than the module-private `readStatus` it was extracted from —
// read-task-status.ts is a different `readStatus` entirely, in this same folder.

/** The challenger's mandatory first line. Anything else is read as "still objecting". */
const STATUS_LINE = /^[^\S\r\n]*status[^\S\r\n]*:[^\S\r\n]*(objecting|conceded)[^\S\r\n]*\r?\n?/i;

/** Split the status line off the prose. No status line ⇒ still objecting. */
export function readChallengerStatus(raw: string): { readonly conceded: boolean; readonly body: string } {
  const match = STATUS_LINE.exec(raw.trimStart());
  if (match?.[1] === undefined) return { conceded: false, body: raw.trim() };
  return {
    conceded: match[1].toLowerCase() === 'conceded',
    body: raw.trimStart().slice(match[0].length).trim(),
  };
}
