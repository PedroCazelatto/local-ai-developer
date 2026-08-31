// Path separator normalization for comparing a path the MODEL wrote against a path git reported. The
// model may echo either separator, and a verdict must not turn on which one it happened to pick.

/** Normalize for comparison — the model may echo a path with either separator. */
export function toPosix(value: string): string {
  return value.replace(/\\/g, '/').trim();
}
