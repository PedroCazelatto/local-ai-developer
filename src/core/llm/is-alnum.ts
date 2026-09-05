// The character class a markdown fence's language tag is allowed to start from, kept apart from the
// filter's state machine so the machine reads as states rather than as regexes.

/** Whether `ch` is a single ASCII letter or digit. */
export function isAlnum(ch: string): boolean {
  return /[A-Za-z0-9]/.test(ch);
}
