// The failure branch of a parse result, built in one place.
//
// It was declared twice as a private `invalid`, in parse-ask-questions.ts and submit-verdict.ts, with
// byte-identical bodies. Splitting either file would have minted a second same-named module, and the
// duplicate check answers first: one function, one home, both callers repointed.
//
// The return type is the bare `{ ok: false; error: string }` rather than either caller's named union,
// which is what lets both take it -- parseVerdict's VerdictParse, parseAskQuestions'
// AskQuestionsParse and parseReviewIssue's inline union all accept it, and none of them has to know
// about the others.

/** A parse result's recoverable-failure branch: what was wrong, in words the model can act on. */
export function parseFailure(error: string): { ok: false; error: string } {
  return { ok: false, error };
}
