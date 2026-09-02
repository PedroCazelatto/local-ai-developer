// The git_inspect actions as a runtime list, for narrowing an untyped argument and for naming the
// legal values back to the model. A VALUE, so it is a plain constant module rather than a .type.ts --
// the same shape core/session/severities.ts and retro-scopes.ts take.
//
// It is a module of its own rather than a constant inside git-inspect.ts because is-inspect-what.ts
// needs it at RUNTIME: leaving it in the tool file would put a real value cycle between the two.

import type { InspectWhat } from './inspect-what.type.js';

/** The legal `what` values, in the order the tool's error message lists them. */
export const INSPECT_WHATS: readonly InspectWhat[] = ['diff', 'log', 'show'];
