// Cap a title at CONTEXT_TITLE_LIMIT on a WORD boundary, so a title is never cut mid-word in a
// listing. Named capTitle rather than the module-private `cap`, which is one of the most overloaded
// three-letter names in the tree.

/** Hard ceiling on a stored title, so one always fits a listing row beside the id and token counts. */
export const CONTEXT_TITLE_LIMIT = 60;

/** Cap at CONTEXT_TITLE_LIMIT on a word boundary where one is near the cut, so a title never ends mid-word. */
export function capTitle(text: string): string {
  if (text.length <= CONTEXT_TITLE_LIMIT) return text;
  const cut = text.slice(0, CONTEXT_TITLE_LIMIT);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace >= CONTEXT_TITLE_LIMIT - 15 ? cut.slice(0, lastSpace) : cut).trimEnd();
}
