// taskBranchName — the branch a task is developed on, derived MECHANICALLY from the backlog so every
// actor spells it the same way. The Worker is told this exact string in its seed and passes it to
// git_branch; nothing has to guess, and a re-run or a later fix round lands on the same branch.
//
// Shape: `task/<id>-<title-slug>`. A task id is already a PATH under backlog/ (see types.ts —
// "epic-auth/story-signup/01-add-hashing-test"), and git branch names take slashes, so the id maps
// straight through and the branch mirrors the backlog tree. The title slug is appended so the branch
// says what the task IS — except when the id's own leaf already ends with it, which is the normal
// case for a file named after its title. Repeating it there would only produce
// `task/…/01-add-hashing-test-add-hashing-test`.

import type { Task } from './types.js';

/** Cap on the appended title slug, so a wordy H1 cannot produce an unreadable branch name. */
const MAX_SLUG_LENGTH = 40;

/** Lowercase, non-alphanumerics collapsed to single dashes, trimmed — the usual kebab-case slug. */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/, '');
}

/**
 * The task id as branch-safe path segments: slashes kept (they nest the branch like the backlog),
 * everything git could choke on replaced. Segments that start or end with a dot, and the ".lock"
 * suffix, are illegal in a ref — strip them here rather than discover it at checkout time.
 */
function safeIdPath(id: string): string {
  return id
    .split('/')
    .map((segment) =>
      segment
        .replace(/[^A-Za-z0-9._-]+/g, '-')
        .replace(/\.lock$/i, '-lock')
        .replace(/-{2,}/g, '-') // after the .lock rewrite, which can itself produce a doubled dash
        .replace(/^[.-]+|[.-]+$/g, ''),
    )
    .filter((segment) => segment !== '')
    .join('/');
}

/**
 * The branch name for `task`. Falls back to the id alone when the title adds nothing — see the file
 * header — and to `task/<slug of the title>` in the pathological case of an id that sanitizes away
 * to nothing.
 */
export function taskBranchName(task: Task): string {
  const idPath = safeIdPath(task.id);
  const titleSlug = slugify(task.title);
  if (idPath === '') return `task/${titleSlug === '' ? 'untitled' : titleSlug}`;

  const leaf = idPath.slice(idPath.lastIndexOf('/') + 1).toLowerCase();
  if (titleSlug === '' || leaf.endsWith(titleSlug)) return `task/${idPath}`;
  return `task/${idPath}-${titleSlug}`;
}
