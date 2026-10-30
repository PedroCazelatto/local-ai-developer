// /help (V5/03) — the self-documenting command list, auto-generated from the command registry so a
// newly registered command shows up here the moment it is added, with no hand-maintained list to
// drift (the bug this prevents).
//
// This file is the ASSEMBLER: it composes the single-function modules beside it into the one command
// object the registry registers, and exports that object and nothing else. It declares no function of
// its own — render-help.ts renders the grouped list and write-command-row.ts prints one row of it.

import type { Command } from '../command.type.js';
import { renderHelp } from './render-help.js';

export const helpCommand: Command = {
  name: 'help',
  group: 'session',
  description: 'List every command, grouped by purpose',
  // renderHelp: the grouped list, read off listCommands() rather than off a static string.
  run: () => renderHelp(),
};
