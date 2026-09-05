// The sentence a rejected shelf label produces. It names the rule that was broken so the model can
// pick a legal label on the next call rather than guessing.

import { MAX_LABEL_LENGTH } from './shelf-label.js';

/** Why `label` was rejected — the exact sentence the model is shown, so it can pick a legal one. */
export function shelfLabelError(label: string): string {
  if (label.length === 0) return "'label' must not be empty.";
  if (label.length > MAX_LABEL_LENGTH) return `'label' must be at most ${MAX_LABEL_LENGTH} characters.`;
  return `'${label}' is not a valid label — use only letters, digits, '.', '-' and '_' (no spaces, no ':').`;
}
