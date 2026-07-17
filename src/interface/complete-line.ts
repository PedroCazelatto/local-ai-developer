// Tab completion for the REPL prompt — Node's readline `completer` hook (wired into createInterface in
// repl.ts). It completes `/command` names straight off the registry, then hands the ARGUMENT being typed
// to that command's own optional complete(). So the registry stays the single source of truth and a newly
// registered command gets completion for free, exactly as /help does via listCommands() — no second list
// to drift out of sync.
//
// SYNCHRONOUS by contract, and that is a hard constraint rather than a preference. readline erases the two
// pinned rows with ESC[0J on every line refresh, and repl.ts repaints them from its `keypress` handler via
// setImmediate. A sync completer prints its candidate list BEFORE that repaint lands, so the rows come
// back; an async one would resolve AFTER it and leave the status + footer rows blank until the next
// keypress. That is exactly why model names are not completed (`/models use <name>` needs an async call to
// the Ollama daemon) while task ids are (readBacklog is a plain sync file read).
//
// A line that doesn't start with '/' gets no candidates, so Tab stays inert while composing a chat message
// instead of completing something the user never asked for.

import { getCommand, listCommands } from './command-registry.js';
import type { ReplOrchestrator } from './repl.js';

/**
 * readline's completer result: the candidate words, and the partial word each one would replace.
 * readline inserts the candidates' common prefix when it extends the partial, and otherwise prints
 * them in columns — so every candidate must be a FULL word that starts with `partial`.
 */
type CompleterResult = [string[], string];

/** Keep only candidates that match what's typed, alphabetized so the printed columns are stable. */
function matching(candidates: string[], partial: string): string[] {
  return candidates.filter((candidate) => candidate.startsWith(partial)).sort((a, b) => a.localeCompare(b));
}

/** Complete `line` (everything up to the cursor) into readline's [candidates, partial] pair. */
export function completeLine(line: string, orch: ReplOrchestrator): CompleterResult {
  if (!line.startsWith('/')) return [[], line];

  // readline hands us the line up to the CURSOR, so the last word is always the one being typed ('' right
  // after a space) and every word before it is settled — the same split repl.ts dispatches on.
  const words = line.slice(1).split(/\s+/);
  const partial = words[words.length - 1] ?? '';

  // Still on the first word: complete the command name itself against the registry.
  if (words.length === 1) return [matching(listCommands().map((c) => c.name), partial), partial];

  // Past the command word: only the command knows what's valid here, so ask it (undefined = no args to
  // complete, e.g. /clear). Candidates come back unfiltered by design; `matching` narrows them.
  const command = getCommand(words[0] ?? '');
  if (command?.complete === undefined) return [[], partial];
  return [matching(command.complete({ orch, args: words.slice(1, -1) }), partial), partial];
}
