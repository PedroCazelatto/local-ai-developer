// The ONLY contract between a spawned Reviewer window and its consumers (V2/02 review integration and
// the REPL renderer). A Reviewer judges ONE Worker attempt and emits exactly one of these; everything
// downstream keys off this parsed, validated shape -- never off free text.

import type { ReviewIssue } from './review-issue.type.js';

export interface ReviewVerdict {
  readonly result: 'pass' | 'fail';
  /** 1–3 sentences: the overall judgment. Always non-empty. */
  readonly summary: string;
  /** Empty when a "pass" carries no findings; ≥1 when "fail". Never a blocker/major on a pass. */
  readonly issues: readonly ReviewIssue[];
}
