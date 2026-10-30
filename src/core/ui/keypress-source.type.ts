// The narrow slice of stdin the two keypress interceptors depend on, taken as a parameter by both and
// declared by neither: bindNewlineKey takes it to put its wrapper in front of readline's own listener,
// and captureTypeAhead takes it to hold keys typed while a turn runs.
//
// Its own module because nothing produces one. It is a dependency-inversion interface — the thing
// depended UPON, never built or returned here — which is exactly what lets either function be driven
// by a plain stream in a verification script instead of a terminal.

import type { KeypressListener } from './keypress-listener.type.js';

/**
 * The slice of the input stream a keypress capture needs — `process.stdin` in the app, a plain stream
 * in a verification script. Depending on the three methods rather than on NodeJS.ReadStream is what
 * lets a binding be driven directly without a terminal. Spoken by bind-newline-key.ts and
 * capture-type-ahead.ts, defined by neither.
 *
 * `listeners` is typed as unknown[] because EventEmitter declares it as Function[], which does not
 * narrow to a specific signature; the callers cast what they take back, exactly as ask-questions.ts does.
 */
export interface KeypressSource {
  listeners(eventName: 'keypress'): readonly unknown[];
  on(eventName: 'keypress', listener: KeypressListener): unknown;
  off(eventName: 'keypress', listener: KeypressListener): unknown;
}
