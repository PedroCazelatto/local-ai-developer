// The user's call after seeing a verdict (V2/02). A closed union, and only "accept" ever commits.

/**
 * The user's call after seeing a verdict (V2/02): commit + mark done, hand back for a manual Worker
 * fix (leave uncommitted), or move on (leave uncommitted). Only "accept" ever triggers the commit.
 */
export type ReviewDecision = 'accept' | 'sendBack' | 'skip';
