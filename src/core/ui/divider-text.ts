// The pinned rule row directly under the input: a full-width dim divider at the current width.
//
// The one row the status bar generates itself rather than being handed already styled, because its
// content is width-derived and nothing above it knows the width at paint time.

import { terminalColumns } from './terminal-columns.js';
import { theme } from './theme.js';

/** The pinned rule row directly under the input: a full-width dim divider at the current width. */
export function dividerText(): string {
  return theme.divider('─'.repeat(terminalColumns()));
}
