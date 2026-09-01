// The convention message for a task-specific Retro commit. No human name anywhere in it (constitution:
// never write the user's name into any file in this repo).

import type { Task } from './task.type.js';

/** The convention message for a task-specific Retro commit — no human name (constitution). */
export function buildRetroCommitMessage(task: Task, rootCause: string): string {
  const subject = `docs(task ${task.id}): clarify task after blocker`;
  const lines = [subject, '', rootCause.trim(), '', 'Retro-patched a task-specific gap surfaced by a resolved blocker.'];
  return lines.join('\n');
}
