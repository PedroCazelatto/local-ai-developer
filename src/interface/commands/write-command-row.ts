// One command's row in the auto-generated /help. Split out of help.ts; `writeCommand` was qualified
// to `writeCommandRow` because a file called write-command.ts reads as "write a command somewhere",
// and what this writes is one padded ROW of a table.

import { write } from '../../core/ui/write.js'; // the raw stdout line a hand-painted table is built from
import { theme } from '../../core/ui/theme.js';
import type { Command } from '../command.type.js';

/** Print one command row: `/name` padded to `width`, its description, and its usage line if it has one. */
export function writeCommandRow(command: Command, width: number): void {
  const name = `/${command.name}`.padEnd(width);
  const desc = command.description.trim() === '' ? '(no description)' : command.description;
  write(`    ${theme.strong(name)}  ${theme.meta(desc)}`);
  if (command.usage !== undefined && command.usage.trim() !== '') {
    write(theme.meta(`    ${' '.repeat(width)}  ${command.usage}`));
  }
}
