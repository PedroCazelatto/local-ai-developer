// The README.md placeholder /new-project writes into a scaffolded project.

import type { Stack } from './stack.type.js';

/** The one-paragraph README a freshly scaffolded project starts with. */
export function readmePlaceholder(name: string, stack: Stack): string {
  return `# ${name}

A ${stack} project scaffolded by Local AI Developer. Planning and execution artifacts live under
\`.orchestrator/\` (git-ignored); the committed narrative is \`PRODUCT_SPEC.md\`.
`;
}
