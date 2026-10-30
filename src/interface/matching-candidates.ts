// The filter behind every Tab completion: keep the candidates that could still be what is being typed,
// in the order the cycle will walk them.
//
// It was `matching` while it was private to complete-line.ts. A file called `matching.ts` names a
// quality rather than a job, so the extraction renames it for what it returns.

/**
 * Keep only candidates that match what's typed, alphabetized. The sort is load-bearing rather than
 * cosmetic: it is the order Tab cycles in, so it has to be the same every time through.
 */
export function matchingCandidates(candidates: string[], partial: string): string[] {
  return candidates.filter((candidate) => candidate.startsWith(partial)).sort((a, b) => a.localeCompare(b));
}
