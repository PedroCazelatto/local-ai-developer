// One phase's open inbox items as a titled block, for the /inbox listing. Split out of inbox.ts.
//
// It returns how many items it printed rather than printing a total itself: `/inbox all` walks the
// six phases and needs the sum, and a block that both printed and counted its own share is the only
// way that total cannot disagree with the rows above it.

import { readInbox } from '../../core/session/read-inbox.js';
import type { InboxItem } from '../../core/session/inbox-item.type.js';
import type { Phase } from '../../core/session/phase.type.js';
import { theme } from '../../core/ui/theme.js';
import { formatLocalStamp } from './format-local-stamp.js';
import { writeFittedLine } from './write-fitted-line.js';
import { writeWrappedLines } from './write-wrapped-lines.js';

/** One phase's open items as a titled block; returns how many it printed. */
export function writePhaseBlock(projectPath: string, phase: Phase, showEmpty: boolean): number {
  // readInbox: replay THIS phase's own JSONL, fold posts + resolves, keep only the unresolved ones.
  const items: InboxItem[] = readInbox(projectPath, phase, 'open');
  if (items.length === 0) {
    if (showEmpty) writeFittedLine(`  ${phase}: no open items`, theme.meta);
    return 0;
  }
  writeFittedLine(`  ${phase} (${items.length} open):`, theme.strong);
  for (const item of items) {
    // formatLocalStamp: the stored UTC stamp on the reader's own wall clock.
    writeFittedLine(`    #${item.id}  from ${item.from}  ·  ${formatLocalStamp(item.created)}`, theme.meta);
    // The body WRAPS rather than being cut: it is a concern one phase raised for another to act on,
    // and the actionable half is as likely to be at the end of it as the start.
    writeWrappedLines(item.body, '      ', theme.meta);
  }
  writeFittedLine('', theme.meta);
  return items.length;
}
