// The pre-send token ESTIMATE every model-facing budget is measured in — and the one place this repo
// knowingly estimates a token count.
//
// THIS IS A SPOKEN, ONE-OFF OVERRIDE of constitution.md's "token counts are always exact", made for
// backlog item 7 and scoped to exactly one job: deciding how much of a text to put in front of the
// model BEFORE it is sent. Ollama has no tokenize endpoint (`/api/tokenize` is a 404 on 0.40.11), so the
// only exact count of a text is a call that really prefills it. A local BPE built from `/api/show`'s
// vocabulary was measured exact, but it needs one pre-tokenizer per model family and some models expose
// no vocabulary at all; the user chose this approximation instead.
//
// What the override does NOT reach: every count that is REPORTED, STORED or used as a TRIGGER — the
// status line, the summarization and eviction thresholds, the audit log, `/resume` — is still Ollama's
// own `prompt_eval_count` / `eval_count`, read through exact-count.ts. Nothing here feeds any of them,
// and nothing here is ever calibrated from them: the estimate only ever sizes an input.
//
// The ratio is the low end of what was measured against Ollama's prompt_eval_count on qwen2.5-coder
// (4.04 chars/token on TypeScript, 4.50 on prose), rounded down, so the estimate errs high and a budget
// cuts slightly early rather than late. Dense JSON measured 1.5 and is under-counted badly — the known
// cost of a ratio that needs no vocabulary.

/** Characters one estimated token stands for. Shared with chars-within-tokens.ts, its inverse. */
export const CHARS_PER_TOKEN = 4;

/** The estimated token count of `text`: its length over CHARS_PER_TOKEN, rounded up. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}
