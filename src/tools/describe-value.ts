// Render an unexpected value back to the model inside an error message.
//
// A string is QUOTED and everything else is not, which is the whole job: `"pass "` and `pass` read
// identically unquoted, and a model that sent a trailing space cannot see what was wrong. The empty
// string is the sharpest case -- unquoted it disappears from the message entirely.
//
// It was declared twice as a private `describe`, in submit-verdict.ts and submit-retro.ts, with
// byte-identical bodies; `describe` alone said nothing about what was being described.

/** An unknown value for an error message: a string quoted, anything else stringified. */
export function describeValue(value: unknown): string {
  return typeof value === 'string' ? `"${value}"` : String(value);
}
