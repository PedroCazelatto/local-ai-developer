// How a finished debate's outcome reads on the closing line render-debate-summary.ts prints.
//
// Three outcomes, not two. A debate whose digest could not be read has no verdict at all, and it says
// so — the missing answer is never quietly rendered as the negative one.

/** The verdict as prose. A null digest says so — it never becomes "did not survive" by default. */
export function debateVerdictText(survived: boolean | null): string {
  if (survived === null) return 'no digest';
  return survived ? 'claim survived' : 'claim did not survive';
}
