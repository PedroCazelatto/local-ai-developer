// Review verdict types (V2/01) — the ONLY contract between a spawned Reviewer window and its
// consumers (V2/02 review integration + the REPL renderer). A Reviewer judges ONE Worker attempt
// and emits exactly one ReviewVerdict; downstream keys off this parsed, validated shape — never off
// free text. Kept here beside worker-runner/reviewer-runner so the runner and the interface share
// one definition (a zero-import leaf module, so tools/ can import the types without a cycle).

/** blocker/major on a verdict force result "fail"; a "minor" may accompany a "pass". */
export type Severity = 'blocker' | 'major' | 'minor';

export const SEVERITIES: readonly Severity[] = ['blocker', 'major', 'minor'];

export interface ReviewIssue {
  /** blocker/major ⇒ the verdict must be "fail"; minor may ride along on a pass. */
  readonly severity: Severity;
  /** Project-relative path, e.g. "src/foo.ts"; "" when the issue isn't file-specific. */
  readonly file: string;
  /** Concrete + actionable: what is wrong and the fix direction (never a vague "looks off"). */
  readonly note: string;
}

export interface ReviewVerdict {
  readonly result: 'pass' | 'fail';
  /** 1–3 sentences: the overall judgment. Always non-empty. */
  readonly summary: string;
  /** Empty when a "pass" carries no findings; ≥1 when "fail". Never a blocker/major on a pass. */
  readonly issues: readonly ReviewIssue[];
}

/**
 * The user's call after seeing a verdict (V2/02): commit + mark done, hand back for a manual Worker
 * fix (leave uncommitted), or move on (leave uncommitted). Only "accept" ever triggers the commit.
 */
export type ReviewDecision = 'accept' | 'sendBack' | 'skip';
