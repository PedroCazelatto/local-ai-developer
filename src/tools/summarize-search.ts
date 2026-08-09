// summarizeSearch — the one line that closes every search_in_files result.
//
// It is written for a model that cannot see the search happen, so it answers two questions the rows
// above it cannot: how much was found, and whether that is ALL of it. A cut result that looks whole is
// the failure mode this exists to prevent — the model reasons over 20 of 300 matches believing it has
// seen the codebase, and every conclusion after that is drawn from a file set it invented. So the
// notice is unconditional: it names the ceiling that fired, or states plainly that none did.
//
// It also names the way out, because the caps cannot be raised by the model. Each suggestion is
// offered only when it applies: no `glob` advice to a caller that already passed one, no
// `context_lines` advice on a search that asked for none, and no `output_mode:"paths"` advice to a
// search already running in that mode.

import type { SearchOutcome } from './search-in-files.type.js';

/** The bracketed closing line for `outcome`. Never empty — a complete search says so explicitly. */
export function summarizeSearch(outcome: SearchOutcome): string {
  const files = `${outcome.files} file${outcome.files === 1 ? '' : 's'}`;
  const matches = `${outcome.matches} match${outcome.matches === 1 ? '' : 'es'}`;

  if (outcome.stop === null) {
    return outcome.outputMode === 'paths' ? `[${files} matched.]` : `[${matches} in ${files}.]`;
  }

  const options: string[] = [];
  if (outcome.stop === 'lines' && outcome.contextLines > 0) options.push("lower 'context_lines'");
  if (!outcome.narrowed) options.push("narrow with 'glob'");
  if (outcome.outputMode === 'content') options.push('use output_mode:"paths"');
  if (options.length === 0) options.push('search for a longer, more specific pattern');

  // "a", "a or b", or "a, b, or c" — via slice/join, so nothing indexes into a possibly-empty array.
  const advice =
    options.length < 2
      ? options.join('')
      : options.length === 2
        ? options.join(' or ')
        : `${options.slice(0, -1).join(', ')}, or ${options.slice(-1).join('')}`;

  if (outcome.stop === 'lines') {
    return `[output stopped at the ${outcome.caps.maxOutputLines}-line budget after ${matches} in ${files}. To see the rest, ${advice}.]`;
  }
  if (outcome.outputMode === 'paths') {
    return `[search stopped at the ${outcome.caps.maxMatches}-file cap. To see the rest, ${advice}.]`;
  }
  return `[search stopped at the ${outcome.caps.maxMatches}-match cap, in ${files}. To see the rest, ${advice}.]`;
}
