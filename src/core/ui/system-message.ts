// Dimmed inline meta line, e.g. `→ tool: read_file` (ports ui.add_system_message).

import { theme } from './theme.js';

/** Dimmed inline meta line, e.g. `→ tool: read_file` (ports ui.add_system_message). */
export function systemMessage(text: string): void {
  process.stdout.write(`${theme.meta(text)}\n`);
}
