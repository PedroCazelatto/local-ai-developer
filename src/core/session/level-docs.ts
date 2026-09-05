// The epic and story README bodies for one task, for the slice of context the Worker is seeded with.
// Best-effort by design: a broken or missing level doc must not sink the run, because the task body is
// what actually specifies the work.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { backlogRoot } from './backlog-root.js';
import { LEVEL_DOC } from './level-doc.js';
import { splitTaskFrontmatter } from './split-task-frontmatter.js';
import type { Task } from './types.js';

/** README.md bodies documenting the task's epic and story levels (best-effort), for the Worker slice. */
export function levelDocs(projectPath: string, task: Task): { epic: string | null; story: string | null } {
  // backlogRoot: <projectPath>/backlog.
  const root = backlogRoot(projectPath);
  const readDoc = (docPath: string): string | null => {
    if (!existsSync(docPath)) return null;
    try {
      // splitTaskFrontmatter: drops any leading YAML block and returns the Markdown body.
      const { body } = splitTaskFrontmatter(readFileSync(docPath, 'utf-8'), docPath);
      const trimmed = body.trim();
      return trimmed === '' ? null : trimmed;
    } catch {
      return null; // a broken level doc must not sink the run — the task body is what matters
    }
  };
  return {
    epic: task.epic ? readDoc(path.join(root, task.epic, LEVEL_DOC)) : null,
    story: task.epic && task.story ? readDoc(path.join(root, task.epic, task.story, LEVEL_DOC)) : null,
  };
}
