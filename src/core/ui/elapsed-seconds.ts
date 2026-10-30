// A millisecond delta as the one-decimal second count the activity line counts up in.
//
// Floored at zero so a clock that went backwards — a resync, a suspended laptop — shows `0.0s` rather
// than a negative timer, which would read as a bug in the thing being timed.

/** One decimal second from a millisecond delta, floored at zero (never shows a negative on clock skew). */
export function elapsedSeconds(deltaMs: number): string {
  return (Math.max(0, deltaMs) / 1000).toFixed(1);
}
