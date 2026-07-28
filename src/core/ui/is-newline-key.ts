// Does this keypress mean "break the line here" rather than "send the message"? The two are distinct
// bytes at the wire, which is the only reason multi-line input is possible at all:
//
//   Enter        -> CR   (0x0D)          readline parses it as `return`  -> submit
//   Shift+Enter  -> LF   (0x0A)          readline parses it as `enter`   -> newline (this predicate)
//   Alt+Enter    -> ESC CR / ESC LF      readline parses it as meta+return/enter -> newline
//
// Enter is CR on every platform we target: libuv clears ICRNL in raw mode on POSIX, and on Windows it
// hands back the VK_RETURN character unchanged, so a bare LF never comes from the Enter key itself.
//
// Terminals do NOT send a distinct Shift+Enter on their own — it has to be bound to emit one of the
// sequences above (see docs/cli.md). Alt+Enter is accepted alongside it because it needs no binding on
// most terminals, so a fresh machine can still compose a multi-line message before anyone edits a
// config. Ctrl+J is byte-identical to Shift+Enter's LF and therefore also breaks the line; there is no
// way to tell them apart, and no reason to.

import type { Key } from 'node:readline';

/** True when `key` should insert a line break into the buffer instead of submitting it. */
export function isNewlineKey(key: Key | undefined): boolean {
  if (key === undefined) return false;
  // Alt/Meta + either newline key. readline itself ignores meta+return entirely, so nothing else
  // competes for it — the line is ours to edit.
  if (key.meta === true) return key.name === 'return' || key.name === 'enter';
  // A bare LF. `return` (CR) is deliberately excluded: that is the submit key.
  return key.name === 'enter';
}
