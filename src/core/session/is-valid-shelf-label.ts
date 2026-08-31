// Is this a legal shelf label? A false here is a model-facing error, not a crash — shelf-label-error.ts
// turns it into the sentence the model reads.

import { LABEL_PATTERN, MAX_LABEL_LENGTH } from './shelf-label.js';

/** True when `label` is a legal shelf label. A false here is a model-facing error, not a crash. */
export function isValidShelfLabel(label: string): boolean {
  return label.length > 0 && label.length <= MAX_LABEL_LENGTH && LABEL_PATTERN.test(label);
}
