// The closed set of phases -- the only valid inbox sender, recipient or resolver, mirroring the six
// rules/phases files. The markdown file the inbox replaced had no such set, so a typo silently
// vanished from every future regex.

/** The closed set of phases — the only valid inbox sender/recipient (mirrors the six rules/phases files). */
export type Phase = 'Discovery' | 'Design' | 'Breakdown' | 'Worker' | 'Reviewer' | 'Retro';
