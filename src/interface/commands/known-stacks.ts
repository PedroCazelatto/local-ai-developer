// The stack names /new-project accepts, in the order they are offered. A vocabulary constant with
// three readers that must never disagree: is-known-stack.ts validates against it, scaffold-project.ts
// names it in both usage lines, and new-project.ts offers it as Tab candidates — so none of them owns
// it.

import type { Stack } from './stack.type.js';

/** The stacks /new-project can scaffold, in the order Tab offers them. */
export const KNOWN_STACKS: readonly Stack[] = ['node', 'python'];
