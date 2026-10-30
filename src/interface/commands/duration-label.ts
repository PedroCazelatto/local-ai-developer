// How long a tool call took, as the /audit listing prints it. Split out of format-audit-row.ts;
// `duration` was renamed `durationLabel` because the bare noun names the value rather than the
// formatting, and this folder already spells that job `<thing>Label` (turn-label.ts, msg-label.ts).

/** Under a second: whole milliseconds. Under a minute: seconds to one decimal. Beyond: `2m 49s`. */
export function durationLabel(ms: number | null): string {
  // An unreported duration is stated as unknown rather than shown as 0ms, which would read as a call
  // that took no time (constitution: surface a missing metric, never substitute a plausible number).
  if (ms === null) return 'unknown';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}m ${whole % 60}s`;
}
