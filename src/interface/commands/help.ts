// /help (V5/03) — the self-documenting command list. It reads the command registry via listCommands()
// and prints every command grouped by purpose with its one-line description, so a newly registered
// command shows up here automatically with NO hand-maintained list to drift (the bug this prevents).
// A command missing a description is surfaced as "(no description)" rather than hidden, and any command
// whose group isn't in the display order below still prints under "Other" — nothing is ever silently
// dropped.

import { theme } from '../../core/ui/theme.js';
import type { Command, CommandGroup } from '../command-registry.js';
import { listCommands } from '../command-registry.js';

/** Display order + human labels for the `/help` sections. A command's `group` keys into this. */
const GROUPS: readonly { readonly id: CommandGroup; readonly label: string }[] = [
  { id: 'session', label: 'Session' },
  { id: 'models', label: 'Models' },
  { id: 'projects', label: 'Projects' },
  { id: 'subagents', label: 'Sub-agents' },
  { id: 'execution', label: 'Execution' },
];

function write(line: string): void {
  process.stdout.write(`${line}\n`);
}

/** Print one command row: `/name` padded to `width`, its description, and its usage line if it has one. */
function writeCommand(command: Command, width: number): void {
  const name = `/${command.name}`.padEnd(width);
  const desc = command.description.trim() === '' ? '(no description)' : command.description;
  write(`    ${theme.strong(name)}  ${theme.meta(desc)}`);
  if (command.usage !== undefined && command.usage.trim() !== '') {
    write(theme.meta(`    ${' '.repeat(width)}  ${command.usage}`));
  }
}

/** Render the full grouped command list (auto-generated from the registry — never a static string). */
function renderHelp(): void {
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
      writeCommand(command, width);
    }
  }

  // Defensive: a command whose group isn't in GROUPS (e.g. a new group id added to the union but not
  // here) still prints — a visible gap, never a silent drop.
  const orphans = commands.filter((c) => !shown.has(c.name));
  if (orphans.length > 0) {
    write('');
    write(theme.strong('  Other'));
    for (const command of orphans) writeCommand(command, width);
  }

  write('');
  write(theme.meta('  Tab: complete a command or its argument · Shift+Tab: cycle the active phase'));
  write(theme.meta('  /swap <phase>: jump straight to one'));
  write('');
}

export const helpCommand: Command = {
  name: 'help',
  group: 'session',
  description: 'List every command, grouped by purpose',
  run: () => renderHelp(),
};
