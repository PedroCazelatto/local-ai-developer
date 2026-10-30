// The severities as a runtime list, for validating a submitted verdict and for naming the legal values
// back to the model. A value, so it is a module rather than a .type.ts.

import type { Severity } from './severity.type.js';

export const SEVERITIES: readonly Severity[] = ['blocker', 'major', 'minor'];
