// Narrow a raw `/new-project <name> <stack>` argument onto the closed Stack union.

import { KNOWN_STACKS } from './known-stacks.js';
import type { Stack } from './stack.type.js';

/** Whether `value` is one of the stacks this build can scaffold. */
export function isKnownStack(value: string): value is Stack {
  return (KNOWN_STACKS as readonly string[]).includes(value);
}
