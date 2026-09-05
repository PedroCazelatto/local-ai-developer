// Recoverable-error line (unknown /swap phase, surfaced tool error). Never throws out.

import { theme } from './theme.js';

/** Recoverable-error line (unknown /swap phase, surfaced tool error). Never throws out. */
export function errorLine(text: string): void {
  process.stdout.write(`${theme.error(text)}\n`);
}
