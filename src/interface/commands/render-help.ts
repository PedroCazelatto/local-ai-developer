// The body of /help: every registered command, grouped by purpose. Split out of help.ts.
//
// It reads the registry via listCommands(), so a newly registered command shows up here automatically
// with NO hand-maintained list to drift (the bug this prevents). A command missing a description is
// surfaced as "(no description)" rather than hidden, and any command whose group is not in the display
// order below still prints under "Other" — nothing is ever silently dropped.
//
// GROUPS has exactly one reader, this function, so it rides with it rather than becoming a module of
// its own.

import { write } from '../../core/ui/write.js'; // the raw stdout line a hand-painted table is built from
import { theme } from '../../core/ui/theme.js';
import type { CommandGroup } from '../command-group.type.js';
import { listCommands } from '../list-commands.js'; // every registered command, in registration order
import { writeCommandRow } from './write-command-row.js'; // one padded `/name  description` row

/** Display order + human labels for the `/help` sections. A command's `group` keys into this. */
const GROUPS: readonly { readonly id: CommandGroup; readonly label: string }[] = [
  { id: 'session', label: 'Session' },
  { id: 'models', label: 'Models' },
  { id: 'projects', label: 'Projects' },
  { id: 'subagents', label: 'Sub-agents' },
  { id: 'execution', label: 'Execution' },
];

/** Render the full grouped command list (auto-generated from the registry — never a static string). */
export function renderHelp(): void {
  const commands = listCommands();
  // Widest `/name` sets the description column, so descriptions line up. +1 for the leading slash.
  const width = Math.max(4, ...commands.map((c) => c.name.length + 1));
  const shown = new Set<string>();

  write('');
  write(theme.strong('Commands:'));
  for (const group of GROUPS) {
    const inGroup = commands.filter((c) => c.group === group.id).sort((a, b) => a.name.localeCompare(b.name));
    if (inGroup.length === 0) continue;
    write('');
    write(theme.strong(`  ${group.label}`));
    for (const command of inGroup) {
      shown.add(command.name);
      writeCommandRow(command, width);
    }
  }

  // Defensive: a command whose group isn't in GROUPS (e.g. a new group id added to the union but not
  // here) still prints — a visible gap, never a silent drop.
  const orphans = commands.filter((c) => !shown.has(c.name));
  if (orphans.length > 0) {
    write('');
    write(theme.strong('  Other'));
    for (const command of orphans) writeCommandRow(command, width);
  }

  write('');
  write(theme.meta('  Shift+Enter (or Ctrl+J / Alt+Enter): break the line instead of sending it'));
  write(theme.meta('  While the model works — Enter: queue the message · ↑: take the last one back'));
  write(theme.meta('  /swap <phase>: jump straight to the phase you want'));
  write('');
}
