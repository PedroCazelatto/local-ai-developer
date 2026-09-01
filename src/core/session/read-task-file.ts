// Read one task .md into a Task. The PATH is the identity: the id is the file's path under backlog/
// without ".md", and the epic / story slugs are simply its first two segments — so the tree on disk
// and the task graph in memory can never disagree about where a task belongs.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { errMessage } from '../err-message.js';
import { BacklogError } from './backlog-error.js';
import { deriveTitle } from './derive-title.js';
import { readDependsOn } from './read-depends-on.js';
import { readOrder } from './read-order.js';
import { readTaskStatus } from './read-task-status.js';
import { splitTaskFrontmatter } from './split-task-frontmatter.js';
import type { Task } from './types.js';

/** Max relative-path segments for a task: epic / story / task. Deeper nesting is rejected. */
const MAX_DEPTH = 3;

/** Read one task .md into a Task; derives id/epic/story from its path under backlog/. */
export function readTaskFile(root: string, filePath: string): Task {
  const rel = path.relative(root, filePath).split(path.sep).join('/');
  const id = rel.replace(/\.md$/i, '');
  const segments = id.split('/');
  if (segments.length > MAX_DEPTH) {
    throw new BacklogError(`Task '${rel}' is nested too deep — the backlog allows at most epic/story/task (three levels).`);
  }
  const epic = segments.length >= 2 ? (segments[0] ?? null) : null;
  const story = segments.length >= 3 ? (segments[1] ?? null) : null;

  let text: string;
  try {
    text = readFileSync(filePath, 'utf-8');
  } catch (err) {
    // errMessage: an Error's message, or the thrown value stringified.
    throw new BacklogError(`Could not read task '${rel}': ${errMessage(err)}`);
  }
  // splitTaskFrontmatter: the task's YAML data + Markdown body; throws BacklogError on bad YAML.
  const { data, body } = splitTaskFrontmatter(text, rel);
  return {
    id,
    filePath,
    // deriveTitle: the body's first H1, else a Title-Cased file slug.
    title: deriveTitle(body, segments[segments.length - 1] ?? id),
    body: body.trim(),
    // readDependsOn: [] when absent, a one-element list for a bare string, else the validated list.
    dependsOn: readDependsOn(data['depends_on'], rel),
    // readOrder: frontmatter `order`, else a leading filename number, else ∞.
    order: readOrder(data['order'], filePath),
    // readTaskStatus: `pending` when absent, a loud BacklogError when present but not a known status.
    status: readTaskStatus(data['status'], rel),
    epic,
    story,
  };
}
