// Record the user's answer to a raised blocker (from /answer). Append-only: the `raised` row is never
// edited, and the pair of rows IS the state.

import { appendJsonlLine } from './append-jsonl-line.js';
import { blockersFile } from './blockers-file.js';
import type { ResolvedBlocker } from './types.js';

/** Record the user's answer to a raised blocker: stamp UTC now, append the `resolved` row, return it. */
export function resolveBlocker(
  projectPath: string,
  input: { readonly id: string; readonly answer: string },
): ResolvedBlocker {
  const resolved: ResolvedBlocker = { id: input.id, answer: input.answer, resolvedAt: new Date().toISOString() };
  // appendJsonlLine: creates the dir, appends ONE line, fsyncs before close.
  appendJsonlLine(blockersFile(projectPath), { kind: 'resolved', ...resolved });
  return resolved;
}
