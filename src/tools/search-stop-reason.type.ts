// Which ceiling ended a search early, or null when the whole project was searched. Set by the tool,
// read by the notice -- folder vocabulary rather than either one's type.

/** Which ceiling ended the search early, or null when the whole project was searched. */
export type SearchStopReason = 'lines' | 'matches' | null;
