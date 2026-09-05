// Surgically rewrite one task file's frontmatter `status:` line, preserving everything else verbatim —
// the file is committed project content a human reads, so a status flip must not reformat it.
//
// Four cases, in order: no frontmatter fence at all, an unterminated fence, a fence that already has a
// status key, and a fence that does not. The first two prepend a fresh block rather than guessing at
// repairing the file.

import type { TaskStatus } from './types.js';

/** Replace (or insert) the frontmatter `status:` line, preserving the rest of the file verbatim. */
export function replaceStatus(text: string, status: TaskStatus): string {
  const nl = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);
  if ((lines[0] ?? '').trim() !== '---') {
    return `---${nl}status: ${status}${nl}---${nl}${nl}${text}`;
  }
  let close = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if ((lines[i] ?? '').trim() === '---') {
      close = i;
      break;
    }
  }
  if (close === -1) {
    return `---${nl}status: ${status}${nl}---${nl}${nl}${text}`; // unterminated fence: prepend a fresh block
  }
  for (let i = 1; i < close; i += 1) {
    if (/^\s*status\s*:/.test(lines[i] ?? '')) {
      lines[i] = `status: ${status}`;
      return lines.join(nl);
    }
  }
  lines.splice(1, 0, `status: ${status}`); // no status key yet — add it at the top of the block
  return lines.join(nl);
}
