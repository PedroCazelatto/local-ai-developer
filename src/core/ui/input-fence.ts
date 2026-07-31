// The fenced input box that stays on screen while a turn runs: rule, `›` row, rule — the last of
// those three being the pinned rule the status bar already owns. A small state machine over three
// collaborators (like status-activity.ts): capture-type-ahead.ts takes the keystrokes, status-bar.ts
// owns the reserved rows they are painted on, and input-fence-row.ts formats the row itself.
//
// The turn loop brackets every model turn with begin/end, and that call is REENTRANT: a sub-agent
// runs its own processMessage inside a tool call of the turn that spawned it, so the inner end() must
// not tear the fence down while the outer turn is still going. Hence the depth count — the fence goes
// up on the first begin and comes down on the last end.
//
// The buffer OUTLIVES a single turn on purpose. A `/run` task loop is many turns with gaps between
// them, and text typed during the Worker must still be there when the Reviewer's turn ends; the REPL
// drains it into the next real prompt, where readline takes over with full editing.

import { stdin, stdout } from 'node:process';

import { captureTypeAhead } from './capture-type-ahead.js';
import { inputFenceRow } from './input-fence-row.js';
import * as messageQueue from './message-queue.js';
import * as renderer from './renderer.js';
import { singleLine } from './single-line.js';
import * as statusBar from './status-bar.js';
import { terminalColumns } from './terminal-columns.js';
import { theme } from './theme.js';

/** How many begin() calls are outstanding — nested turns share one fence. */
let depth = 0;
/** The active capture's stop function (restores stdin's listeners, returns the buffer); null when down. */
let stop: (() => string) | null = null;
/** Text typed while turns ran, waiting for the next prompt to claim it. */
let pending = '';

/** Repaint the type-ahead row after an edit — one reserved row, so it costs no scrolling. */
function render(text: string): void {
  statusBar.setInputFence(inputFenceRow(text, terminalColumns(), messageQueue.size()));
}

/**
 * Enter mid-turn: the message joins the queue the REPL drains when the turn ends, and says so in the
 * scrollback right away — a message that vanished into a queue with no trace would be indistinguishable
 * from one that was dropped. interjectLine is what makes that safe to print into a reply in flight.
 */
function submit(text: string): void {
  messageQueue.enqueue(text);
  renderer.interjectLine(theme.meta(`⏳ queued: ${singleLine(text)}`));
}

/**
 * ↑ mid-turn: the newest queued message comes back into the row to edit, and the scrollback says so
 * too. Without that line the history would keep claiming a message was queued that never ran — and
 * history here is append-only, so the original line cannot be taken back.
 */
function recall(): string | null {
  const text = messageQueue.recall();
  if (text !== null) renderer.interjectLine(theme.meta(`↩ un-queued: ${singleLine(text)}`));
  return text;
}

/**
 * A turn started: raise the fence and take stdin, seeded with anything typed during an earlier turn.
 * Off a TTY there is nothing to pin and no keypress events to read, so it does nothing at all.
 */
export function begin(): void {
  depth += 1;
  if (depth > 1 || stop !== null) return;
  if (!stdin.isTTY || !stdout.isTTY) return;
  // captureTypeAhead: suspends every keypress listener (readline's included, so nothing echoes into
  // the streamed reply) and owns the keys until the returned stop() restores them — printable keys and
  // backspace build the row, Enter queues it, ↑ takes the last one back.
  stop = captureTypeAhead(stdin, pending, { onChange: render, onSubmit: submit, onRecall: recall });
  statusBar.showInputFence(inputFenceRow(pending, terminalColumns(), messageQueue.size()));
}

/** A turn ended: on the LAST outstanding begin, give stdin back and drop the fence. */
export function end(): void {
  if (depth > 0) depth -= 1;
  if (depth > 0) return;
  if (stop !== null) {
    pending = stop();
    stop = null;
  }
  statusBar.hideInputFence();
}

/** Take what was typed during the turns, clearing it — the REPL writes it into the next prompt. */
export function drain(): string {
  const typed = pending;
  pending = '';
  return typed;
}

/**
 * Force the fence down whatever the depth, keeping the buffer. The REPL calls this after each command
 * so a turn that threw between begin() and end() can never leave stdin captured — which would be a
 * dead prompt, not just a stray rule.
 */
export function reset(): void {
  depth = 0;
  if (stop !== null) {
    pending = stop();
    stop = null;
  }
  statusBar.hideInputFence();
}
