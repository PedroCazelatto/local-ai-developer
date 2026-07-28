// Types for bind-newline-key.ts (constitution: types live in a sibling file, never inline).

import type { Key } from 'node:readline';

/** A `keypress` listener as `emitKeypressEvents` emits them: the decoded string plus the parsed key. */
export type KeypressListener = (str: string | undefined, key: Key | undefined) => void;

/**
 * The slice of the input stream bind-newline-key.ts needs — `process.stdin` in the app, a plain
 * stream in a verification script. Depending on the three methods rather than on NodeJS.ReadStream
 * is what lets the binding be driven directly without a terminal.
 *
 * `listeners` is typed as unknown[] because EventEmitter declares it as Function[], which does not
 * narrow to a specific signature; the binding casts what it takes back, exactly as ask-questions.ts does.
 */
export interface KeypressSource {
  listeners(eventName: 'keypress'): readonly unknown[];
  on(eventName: 'keypress', listener: KeypressListener): unknown;
  off(eventName: 'keypress', listener: KeypressListener): unknown;
}
