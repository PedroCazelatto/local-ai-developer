// How long ago something was created, as the /subagents listing prints it. Split out of subagents.ts.
//
// Named ageLabel rather than the private `ageSince` it was extracted from: `since` names the
// ARGUMENT, not the job, and this folder already spells "format this value for display"
// `<thing>Label` — duration-label.ts, msg-label.ts, token-label.ts, exit-label.ts.

/** Human age from a createdAt (ms epoch) to now: `4s`, `1m 4s`, `1h 2m`. */
export function ageLabel(createdAt: number): string {
  const totalSec = Math.max(0, Math.floor((Date.now() - createdAt) / 1000));
  if (totalSec < 60) return `${totalSec}s`;
  const min = Math.floor(totalSec / 60);
  if (min < 60) return `${min}m ${totalSec % 60}s`;
  const hr = Math.floor(min / 60);
  return `${hr}h ${min % 60}m`;
}
