// The signature of a `keypress` handler, spoken by four files in this folder and declared by none of
// them: ask-questions.ts and capture-type-ahead.ts snapshot the stream's existing listeners to mute
// readline while they own the terminal, bind-newline-key.ts puts its own wrapper in front of them, and
// confirm-key.ts attaches a throwaway one-shot listener for a single y/n key.
// It is Node's event shape rather than any one function's parameter or return, so it gets its own
// module.
//
// It exists as a named type mainly to be cast TO: `listeners('keypress')` hands back `unknown[]` (see
// keypress-source.type.ts for why), and every one of the three casts the result to this.

import type { Key } from 'node:readline';

/** A `keypress` listener as `emitKeypressEvents` emits them: the decoded string plus the parsed key. */
export type KeypressListener = (str: string | undefined, key: Key | undefined) => void;
