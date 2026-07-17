// Single-keypress y/n confirmation — resolves on ONE key, no Enter required. Used by `/models use
// <name>` to offer pulling a not-yet-installed model inline ("Download it now? (y/n)" answered with a
// single y/n keystroke), and by the boot model resolution to offer the same before any REPL exists.
//
// Why it detaches readline's keypress handling for the read: inside the REPL, readline owns stdin and
// buffers EVERY printable keypress into its own line even between questions (`this.line`) — so a naive
// read would leak the pressed `y`/`n` into the next `› ` prompt. We therefore snapshot and remove all
// current `keypress` listeners (readline's internal handler AND the REPL's status-repaint handler),
// attach a throwaway one-shot listener for the single key, then restore the originals — leaving stdin
// exactly as found.

import { stdin } from 'node:process';
import { emitKeypressEvents } from 'node:readline';
import type { Key } from 'node:readline';

import { theme } from './theme.js';

/** A `keypress` listener as `emitKeypressEvents` emits them: the decoded string plus the parsed key. */
type KeypressListener = (str: string | undefined, key: Key | undefined) => void;

/**
 * Prompt `message` and BLOCK on a single keypress: `y`/`Y` → true, `n`/`N` → false, Esc or Ctrl-C →
 * false (treated as "no"). Any other key is ignored and we keep waiting. Off a TTY there is no raw
 * single-key read, so we skip the prompt and return false (the safe "don't act" default).
 */
export async function confirmKey(message: string): Promise<boolean> {
  if (!stdin.isTTY) return false;

  // Install the byte→`keypress` decoder. Inside the REPL, createInterface already did this and the call
  // is a no-op (Node guards it with an internal symbol); at boot NOTHING has, and without it no
  // `keypress` event would ever fire and the await below would hang forever. The decoder attaches its
  // own `data` listener that survives our snapshot/restore, so events keep flowing to our listener.
  emitKeypressEvents(stdin);

  process.stdout.write(`${theme.meta(message)} ${theme.meta('(y/n)')} `);

  // Take stdin raw for the read (readline usually already has it raw; restore whatever we found).
  const priorRaw = stdin.isRaw;
  stdin.setRawMode(true);
  // Suspend every existing keypress listener so readline can't buffer our keystroke into its line.
  const suspended = stdin.listeners('keypress') as KeypressListener[];
  for (const listener of suspended) stdin.off('keypress', listener);

  try {
    const answer = await new Promise<boolean>((resolve) => {
      const finish = (value: boolean): void => {
        stdin.off('keypress', onKey);
        resolve(value);
      };
      const onKey: KeypressListener = (_str, key) => {
        if (key === undefined) return;
        if (key.ctrl === true && key.name === 'c') return finish(false); // Ctrl-C → cancel = no
        if (key.name === 'escape') return finish(false);
        const ch = (key.name ?? key.sequence ?? '').toLowerCase();
        if (ch === 'y') return finish(true);
        if (ch === 'n') return finish(false);
        // any other key: ignore and keep listening
      };
      stdin.on('keypress', onKey);
    });
    // Echo the resolution (raw mode swallowed the keystroke's own echo) so scrollback records the choice.
    process.stdout.write(`${answer ? theme.success('y') : theme.error('n')}\n`);
    return answer;
  } finally {
    for (const listener of suspended) stdin.on('keypress', listener);
    stdin.setRawMode(priorRaw);
  }
}
