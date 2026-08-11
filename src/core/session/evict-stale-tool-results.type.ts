// Types for the tool-result eviction pass (sibling of evict-stale-tool-results.ts). Kept beside the
// function they serve, per the constitution — types never live inline with a function.

/**
 * One tool result the pass decided to replace, addressed by its position in the window's message array.
 *
 * The pass returns rewrites rather than a new array so it stays PURE: it decides, the window applies.
 * That is also what keeps the whole policy callable from a throwaway script with no Ollama and no
 * WorkerWindow (CLAUDE.md: verify by driving the specific function directly).
 *
 * `index` is load-bearing beyond the write itself: the LOWEST index in a batch is the exact point from
 * which Ollama must re-evaluate the prompt, so it is the number that explains what the pass cost.
 */
export interface EvictionRewrite {
  /** Position in the window's `messages` array. Always a `tool` message. */
  readonly index: number;
  /** The stub that replaces the result's text (format-evicted-stub.ts). */
  readonly content: string;
}
