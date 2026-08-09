// parseSearchRequest — turn the raw `args` of a search_in_files call into a validated SearchRequest,
// or into the model-facing reason it is not one. Every argument check for the tool lives here, so the
// tool's own execute reads as the search it performs rather than as a wall of type guards.
//
// A bad argument is NEVER fatal: this returns a reason the dispatcher hands back as tool output and
// the model retries from (V1/02). Numbers are checked strictly — a string "3" is rejected rather than
// coerced, matching git_inspect's `count`.
//
// `context_lines` deliberately carries NO ceiling of its own. An absurd value is not refused and is
// not clamped to an invented number: it simply makes the first matching file fill the line budget,
// which stops the output and says so. The three caps in search-in-files.ts are the only limits.

import type { SearchOutputMode, SearchRequestParse } from './search-in-files.type.js';

export function parseSearchRequest(args: Record<string, unknown>): SearchRequestParse {
  const pattern = args['pattern'];
  if (typeof pattern !== 'string' || pattern === '') {
    return { ok: false, error: "'pattern' must be a non-empty string." };
  }

  const rawGlob = args['glob'];
  if (rawGlob !== undefined && typeof rawGlob !== 'string') {
    return { ok: false, error: "'glob' must be a string if provided." };
  }
  const glob = typeof rawGlob === 'string' && rawGlob.trim() !== '' ? rawGlob.trim() : null;

  const rawMode = args['output_mode'];
  if (rawMode !== undefined && rawMode !== 'content' && rawMode !== 'paths') {
    return {
      ok: false,
      error: `'output_mode' must be "content" or "paths" (got ${JSON.stringify(rawMode)}).`,
      hint: 'Leave it out for matching lines; use "paths" when you only need to know which files match.',
    };
  }
  const outputMode: SearchOutputMode = rawMode === 'paths' ? 'paths' : 'content';

  const rawContext = args['context_lines'];
  if (rawContext !== undefined && (typeof rawContext !== 'number' || !Number.isFinite(rawContext))) {
    return { ok: false, error: "'context_lines' must be a number." };
  }
  // Normalize only: a negative or fractional count is nonsense rather than policy, so it is floored
  // at 0 and truncated to an integer instead of being refused.
  const contextLines = typeof rawContext === 'number' ? Math.max(0, Math.trunc(rawContext)) : 0;

  const rawCaseSensitive = args['case_sensitive'];
  if (rawCaseSensitive !== undefined && typeof rawCaseSensitive !== 'boolean') {
    return { ok: false, error: "'case_sensitive' must be true or false." };
  }

  return {
    ok: true,
    request: {
      pattern,
      glob,
      outputMode,
      contextLines,
      caseSensitive: rawCaseSensitive === true,
    },
  };
}
