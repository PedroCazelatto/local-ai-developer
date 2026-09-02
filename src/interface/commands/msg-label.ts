// A sub-agent's message count, as the /subagents listing prints it. Split out of subagents.ts, and
// the name duration-label.ts's header already predicted for it.

/** `12 msgs` / `1 msg` — small pluralization for the message count. */
export function msgLabel(count: number): string {
  return `${count} ${count === 1 ? 'msg' : 'msgs'}`;
}
