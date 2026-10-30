// Every objection after the first, handed to the proponent. Short by design: its window already holds
// the claim and the material from the opening seed, and repeating them would spend num_ctx per round.

/** Every later objection handed to the proponent. */
export function nextObjectionRequest(objection: string, round: number): string {
  return `## Objection (round ${round})\n\n${objection}\n\nAnswer this objection, or concede it.`;
}
