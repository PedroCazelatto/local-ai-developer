// Hard ceiling on challenger turns, enforced by the loop and NOT settable by the model — the same rule
// as MAX_TOOL_ROUNDS and SUBAGENT_MAX_ROUNDS.
//
// Five is enough for an objection to be raised, answered, sharpened, answered again and closed; past
// that a local model repeats itself, and every extra round is VRAM and wall-clock spent on a decision
// the digest could already have reported.
//
// In one place because two readers share it: the loop that stops at it, and the budget line that tells
// the challenger how many turns it has left so it spends its strongest ground first.

/** Hard ceiling on challenger turns. */
export const MAX_DEBATE_ROUNDS = 5;
