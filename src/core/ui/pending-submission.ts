// The edit buffer exactly as it stood when Enter was pressed, captured before readline submits it.
// Readline hands back a different string for a multi-line buffer than the one it held, so this is the
// copy the REPL trusts. Empty when nothing is pending.

export const pendingSubmission: { line: string } = { line: '' };
