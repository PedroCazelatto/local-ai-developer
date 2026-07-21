// The longest string that every word starts with — how far a Tab can safely extend an ambiguous
// completion without choosing between the candidates (complete-action.ts). Empty for no shared start.

/** Longest common leading substring across `words`; '' when they share none (or the list is empty). */
export function longestCommonPrefix(words: readonly string[]): string {
  if (words.length === 0) return '';
  let prefix = words[0] ?? '';
  for (const word of words) {
    let i = 0;
    while (i < prefix.length && i < word.length && prefix[i] === word[i]) i += 1;
    prefix = prefix.slice(0, i);
    if (prefix === '') break;
  }
  return prefix;
}
