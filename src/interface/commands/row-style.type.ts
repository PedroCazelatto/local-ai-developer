// The theme styler an inspection command paints one row with — text in, ANSI-wrapped text out. Every
// colour in the UI lives in theme.ts alone, so this type is how a row carries its colour without
// choosing one (constitution, Terminal UX).
//
// Owned by no function: write-fitted-line.ts and write-wrapped-lines.ts take one, task-status-style.ts
// returns one, fitted-row.type.ts carries one, and /tasks, /blockers, /inbox, /audit and /batch all hand
// one in. It is the folder's vocabulary, so it gets its own file.

/** A styler from theme.ts — text in, ANSI-wrapped text out. Every color in the UI lives in theme.ts alone. */
export type RowStyle = (text: string) => string;
