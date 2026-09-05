// Replay the question store. asked / answered / delivered state is DERIVED from these rows, never
// mutated in place.
//
// Named readQuestionRows rather than the module-private `readRows` it was extracted from: `readRows`
// says nothing standing alone beside read-blocker-rows.ts in a flat folder.

import { existsSync, readFileSync } from 'node:fs';

import { isQuestionRow } from './is-question-row.js';
import { questionsFile } from './questions-file.js';
import type { QuestionRow } from './types.js';

/** Read + parse every row; a malformed line is skipped (a torn last line must not sink replay). */
export function readQuestionRows(projectPath: string): QuestionRow[] {
  // questionsFile: <projectPath>/.orchestrator/questions.jsonl.
  const file = questionsFile(projectPath);
  if (!existsSync(file)) return [];
  const rows: QuestionRow[] = [];
  for (const line of readFileSync(file, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '') continue;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      // isQuestionRow: drops a row that does not match its own `kind`.
      if (isQuestionRow(parsed)) rows.push(parsed);
    } catch {
      // A partial/torn line (e.g. a kill mid-write) — skip it, keep replaying the intact rows.
    }
  }
  return rows;
}
