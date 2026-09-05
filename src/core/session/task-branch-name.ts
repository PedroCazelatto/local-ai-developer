// taskBranchName — the branch a task is developed on, derived MECHANICALLY from the backlog so every
// actor spells it the same way. The Worker is told this exact string in its seed and passes it to
// git_branch; nothing has to guess, and a re-run or a later fix round lands on the same branch.
//
// Shape: `task/<id>-<title-slug>`. A task id is already a PATH under backlog/ (see task.type.ts —
// "epic-auth/story-signup/01-add-hashing-test"), and git branch names take slashes, so the id maps
// straight through and the branch mirrors the backlog tree. The title slug is appended so the branch
// says what the task IS — except when the id's own leaf already ends with it, which is the normal
// case for a file named after its title. Repeating it there would only produce
// `task/…/01-add-hashing-test-add-hashing-test`.

import { safeIdPath } from './safe-id-path.js';
import { slugify } from './slugify.js';
import type { Task } from './task.type.js';

/**
 * The branch name for `task`. Falls back to the id alone when the title adds nothing — see the file
 * header — and to `task/<slug of the title>` in the pathological case of an id that sanitizes away
 * to nothing.
 */
export function taskBranchName(task: Task): string {
  // safeIdPath: the id with slashes kept and every segment made legal as a ref component.
  const idPath = safeIdPath(task.id);
  // slugify: lowercase kebab-case, capped at 40 chars.
  const titleSlug = slugify(task.title);
  if (idPath === '') return `task/${titleSlug === '' ? 'untitled' : titleSlug}`;

  const leaf = idPath.slice(idPath.lastIndexOf('/') + 1).toLowerCase();
  if (titleSlug === '' || leaf.endsWith(titleSlug)) return `task/${idPath}`;
  return `task/${idPath}-${titleSlug}`;
}
