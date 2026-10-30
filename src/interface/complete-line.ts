// The catalog of what completes where, for the REPL prompt. It completes `/command` names straight off
// the registry, then hands the ARGUMENT being typed to that command's own optional complete(). So the
// registry stays the single source of truth and a newly registered command gets completion for free,
// exactly as /help does via listCommands() — no second list to drift out of sync.
//
// SYNCHRONOUS by contract, and that is a hard constraint rather than a preference. Completion runs
// INLINE in the keypress handler, and run-repl.ts repaints the pinned status rows from a setImmediate
// scheduled by that same handler; an async lookup would resolve after that repaint and leave the rows
// blanked until the next keystroke. That is why task ids ARE completed (readBacklog is a plain sync
// file read) while model names are NOT (`/models use <name>` would need a call to the Ollama daemon).
//
// A line that doesn't start with '/' gets no candidates, so Tab stays inert while composing a chat
// message instead of completing something the user never asked for.

import { getCommand } from './get-command.js';
import { listCommands } from './list-commands.js';
import { matchingCandidates } from './matching-candidates.js'; // prefix-filtered and alphabetized -- the order Tab cycles in
import type { ReplOrchestrator } from './run-repl.js';

/**
 * The candidate words, and the partial word each one replaces. Shaped as readline's completer result
 * because that is exactly what the caller needs — the words to offer and the span they stand in for —
 * even though run-repl.ts drives Tab from the keypress handler rather than handing this to readline.
 * cycle-completion.ts is what steps through the words; this file only decides which words they are.
 */
type CompleterResult = [string[], string];

/** Every candidate for the word being typed at the end of `line` (the line up to the cursor), + that word. */
export function completeLine(line: string, orch: ReplOrchestrator): CompleterResult {
  if (!line.startsWith('/')) return [[], line];

  // The caller passes the line up to the CURSOR, so the last word is always the one being typed ('' right
  // after a space) and every word before it is settled — the same split handle-command.ts dispatches on.
  const words = line.slice(1).split(/\s+/);
  const partial = words[words.length - 1] ?? '';

  // Still on the first word: complete the command name itself against the registry.
  if (words.length === 1) return [matchingCandidates(listCommands().map((c) => c.name), partial), partial];

  // Past the command word: only the command knows what's valid here, so ask it (undefined = no args to
  // complete, e.g. /clear). Candidates come back unfiltered by design; `matchingCandidates` narrows them.
  const command = getCommand(words[0] ?? '');
  if (command?.complete === undefined) return [[], partial];
  return [matchingCandidates(command.complete({ orch, args: words.slice(1, -1) }), partial), partial];
}
