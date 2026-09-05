// A context's turn count, as the /resume listing prints it. Split out of resume.ts, and the name
// duration-label.ts's own header already predicted for it.

/** `47 turns` / `1 turn` — small pluralization for the count line. */
export function turnLabel(count: number): string {
  return `${count} ${count === 1 ? 'turn' : 'turns'}`;
}
