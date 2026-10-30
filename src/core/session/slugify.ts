// The kebab-case slug a task title contributes to its branch name. Capped, so a wordy H1 cannot
// produce an unreadable branch.

/** Cap on the appended title slug, so a wordy H1 cannot produce an unreadable branch name. */
const MAX_SLUG_LENGTH = 40;

/** Lowercase, non-alphanumerics collapsed to single dashes, trimmed — the usual kebab-case slug. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/, '');
}
